import { getCloudBaseClient, type CloudBaseDatabase } from '@/lib/cloudbase';
import type {
  UserProfileDocument,
  UserProfileResult,
  UserProfileState,
} from '@/types/user-profile';

const USERS_COLLECTION = 'users';
const PROFILE_STORAGE_KEY = 'hdp-cloudbase-visitor-profile';
export const DEFAULT_NICKNAME = '匿名访客';

type DatabaseWithServerDate = CloudBaseDatabase & {
  serverDate(options?: { offset?: number }): unknown;
};

function serverDate(database: CloudBaseDatabase): unknown {
  return (database as DatabaseWithServerDate).serverDate();
}

function cachedState(uid: string, nickname: string, available: boolean): UserProfileState {
  const now = new Date();
  return {
    uid,
    nickname,
    loginType: 'ANONYMOUS',
    createdAt: now,
    updatedAt: now,
    syncStatus: available ? 'cached' : 'unavailable',
    syncMessage: available
      ? '云端暂时不可用，当前显示本机缓存'
      : '云端和本机缓存暂时都不可用',
  };
}

export function getCachedNickname(uid: string): string | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw) as { uid?: unknown; nickname?: unknown };
    if (profile.uid !== uid || typeof profile.nickname !== 'string') return null;
    const validated = validateNickname(profile.nickname);
    return validated.ok ? validated.data.nickname : null;
  } catch {
    return null;
  }
}

function cacheNickname(uid: string, nickname: string): boolean {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ uid, nickname }));
    return true;
  } catch {
    return false;
  }
}

export function validateNickname(value: string): UserProfileResult {
  const nickname = value.trim().replace(/\s+/gu, ' ');
  const length = Array.from(nickname).length;
  const hasMarkup =
    /[<>]/u.test(nickname) ||
    /&(?:lt|gt|#0*60|#0*62|#x0*3c|#x0*3e);/iu.test(nickname);
  const hasControlCharacters = /[\u0000-\u001f\u007f]/u.test(nickname);

  if (length < 2 || length > 16) {
    return { ok: false, message: '昵称需要保持在 2 到 16 个字符之间。' };
  }
  if (hasMarkup || hasControlCharacters) {
    return { ok: false, message: '昵称不能包含 HTML 标签或控制字符。' };
  }

  const now = new Date();
  return {
    ok: true,
    data: {
      uid: '',
      nickname,
      loginType: 'ANONYMOUS',
      createdAt: now,
      updatedAt: now,
      syncStatus: 'cached',
      syncMessage: '',
    },
  };
}

function normalizeCloudProfile(data: unknown, uid: string): UserProfileDocument | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Partial<UserProfileDocument>;
  if (record.uid !== uid || typeof record.nickname !== 'string') return null;
  const validated = validateNickname(record.nickname);
  if (!validated.ok) return null;
  return {
    _id: typeof record._id === 'string' ? record._id : undefined,
    uid,
    nickname: validated.data.nickname,
    loginType: 'ANONYMOUS',
    createdAt: record.createdAt instanceof Date ? record.createdAt : new Date(),
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt : new Date(),
  };
}

function syncedState(profile: UserProfileDocument): UserProfileState {
  return {
    ...profile,
    syncStatus: 'synced',
    syncMessage: '已同步到云端',
  };
}

async function queryProfile(
  database: CloudBaseDatabase,
  uid: string,
): Promise<UserProfileDocument | null> {
  const result = await database
    .collection(USERS_COLLECTION)
    .where({ uid })
    .limit(1)
    .get();
  return normalizeCloudProfile(result.data[0], uid);
}

function fallbackProfile(uid: string): UserProfileState {
  const cachedNickname = getCachedNickname(uid);
  const nickname = cachedNickname || DEFAULT_NICKNAME;
  return cachedState(uid, nickname, cacheNickname(uid, nickname));
}

export async function getOrCreateUserProfile(uid: string): Promise<UserProfileResult> {
  const cloudbase = await getCloudBaseClient();
  if (!cloudbase.ok) return { ok: true, data: fallbackProfile(uid) };

  try {
    const existing = await queryProfile(cloudbase.client.database, uid);
    if (existing) {
      cacheNickname(uid, existing.nickname);
      return { ok: true, data: syncedState(existing) };
    }

    const nickname = getCachedNickname(uid) || DEFAULT_NICKNAME;
    const timestamp = serverDate(cloudbase.client.database);
    await cloudbase.client.database.collection(USERS_COLLECTION).add({
      _id: uid,
      uid,
      nickname,
      loginType: 'ANONYMOUS',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const created = await queryProfile(cloudbase.client.database, uid);
    const profile =
      created ||
      ({
        _id: uid,
        uid,
        nickname,
        loginType: 'ANONYMOUS',
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies UserProfileDocument);
    cacheNickname(uid, profile.nickname);
    return { ok: true, data: syncedState(profile) };
  } catch {
    try {
      const existing = await queryProfile(cloudbase.client.database, uid);
      if (existing) {
        cacheNickname(uid, existing.nickname);
        return { ok: true, data: syncedState(existing) };
      }
    } catch {
      // Fall back to the UID-bound local cache without exposing database details.
    }
    return { ok: true, data: fallbackProfile(uid) };
  }
}

export async function updateUserProfileNickname(
  uid: string,
  value: string,
): Promise<UserProfileResult> {
  const validated = validateNickname(value);
  if (!validated.ok) return validated;
  const nickname = validated.data.nickname;
  const cached = cacheNickname(uid, nickname);
  const cloudbase = await getCloudBaseClient();

  if (!cloudbase.ok) {
    return { ok: true, data: cachedState(uid, nickname, cached) };
  }

  try {
    await getOrCreateUserProfile(uid);
    const result = await cloudbase.client.database
      .collection(USERS_COLLECTION)
      .where({ uid })
      .update({
        nickname,
        updatedAt: serverDate(cloudbase.client.database),
      });

    if (!result.updated) throw new Error('profile-not-updated');
    const profile = await queryProfile(cloudbase.client.database, uid);
    if (profile) return { ok: true, data: syncedState(profile) };
    return {
      ok: true,
      data: syncedState({
        uid,
        nickname,
        loginType: 'ANONYMOUS',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };
  } catch {
    return { ok: true, data: cachedState(uid, nickname, cached) };
  }
}
