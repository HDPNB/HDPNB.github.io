import {
  getCloudBaseClient,
  type CloudBaseDatabase,
} from '@/lib/cloudbase';
import { getOrCreateUserProfile } from '@/lib/user-profile';
import type {
  GuestbookMessageDocument,
  GuestbookResult,
  GuestbookStatus,
} from '@/types/guestbook';

const COLLECTION = 'guestbook_messages';
const RATE_LIMIT_KEY = 'hdp-guestbook-last-submit';
const RATE_LIMIT_MS = 60_000;

type DatabaseWithServerDate = CloudBaseDatabase & {
  serverDate(options?: { offset?: number }): unknown;
};

function serverDate(database: CloudBaseDatabase): unknown {
  return (database as DatabaseWithServerDate).serverDate();
}

function getUid(user: unknown): string | null {
  if (!user || typeof user !== 'object' || !('uid' in user)) return null;
  const uid = user.uid;
  return typeof uid === 'string' && uid.trim() ? uid : null;
}

function parseDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function normalizeMessage(value: unknown): GuestbookMessageDocument | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const status = item.status as GuestbookStatus;
  if (
    typeof item._id !== 'string' ||
    typeof item.uid !== 'string' ||
    typeof item.nickname !== 'string' ||
    typeof item.content !== 'string' ||
    !['pending', 'approved', 'rejected'].includes(status)
  ) {
    return null;
  }
  return {
    _id: item._id,
    uid: item.uid,
    nickname: item.nickname,
    content: item.content,
    status,
    createdAt: parseDate(item.createdAt),
    updatedAt: parseDate(item.updatedAt),
    reply: typeof item.reply === 'string' ? item.reply : '',
    repliedAt: item.repliedAt ? parseDate(item.repliedAt) : null,
  };
}

function databaseFailure<T>(): GuestbookResult<T> {
  return {
    ok: false,
    code: 'database-error',
    message: '留言功能暂时未开放，请稍后再来看看。',
  };
}

function getLastSubmit(uid: string): number {
  try {
    const value = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '{}') as {
      uid?: unknown;
      at?: unknown;
    };
    return value.uid === uid && typeof value.at === 'number' ? value.at : 0;
  } catch {
    return 0;
  }
}

function rememberSubmit(uid: string): void {
  try {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ uid, at: Date.now() }));
  } catch {
    // The database write already succeeded; local rate limiting is best effort only.
  }
}

function validateContent(value: string): GuestbookResult<string> {
  const content = value.trim();
  const length = Array.from(content).length;
  const hasMarkup =
    /[<>]/u.test(content) ||
    /&(?:lt|gt|#0*60|#0*62|#x0*3c|#x0*3e);/iu.test(content);
  const hasUnsafeControlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(content);

  if (!content || length > 300) {
    return {
      ok: false,
      code: 'invalid-content',
      message: '留言需要保持在 1 到 300 个字符之间。',
    };
  }
  if (hasMarkup || hasUnsafeControlCharacters) {
    return {
      ok: false,
      code: 'invalid-content',
      message: '留言只能使用纯文本，不能包含 HTML 标签。',
    };
  }
  return { ok: true, data: content };
}

export async function loadGuestbookMessages(): Promise<
  GuestbookResult<GuestbookMessageDocument[]>
> {
  const cloudbase = await getCloudBaseClient();
  if (!cloudbase.ok) {
    return {
      ok: false,
      code: 'disabled',
      message: '留言功能暂时未开放。',
    };
  }

  try {
    const approvedResult = await cloudbase.client.database
      .collection(COLLECTION)
      .where({ status: 'approved' })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const user = await cloudbase.client.auth.getCurrentUser();
    const uid = getUid(user);
    let ownData: unknown[] = [];
    if (uid) {
      const ownResult = await cloudbase.client.database
        .collection(COLLECTION)
        .where({ uid })
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      ownData = ownResult.data;
    }

    const merged = new Map<string, GuestbookMessageDocument>();
    [...approvedResult.data, ...ownData].forEach((item) => {
      const normalized = normalizeMessage(item);
      if (normalized) merged.set(normalized._id, normalized);
    });

    return {
      ok: true,
      data: [...merged.values()].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      ),
    };
  } catch {
    return databaseFailure();
  }
}

export async function submitGuestbookMessage(
  rawContent: string,
): Promise<GuestbookResult<null>> {
  const validated = validateContent(rawContent);
  if (!validated.ok) return validated;

  const cloudbase = await getCloudBaseClient();
  if (!cloudbase.ok) {
    return {
      ok: false,
      code: 'disabled',
      message: '留言功能暂时未开放。',
    };
  }

  try {
    const user = await cloudbase.client.auth.getCurrentUser();
    const uid = getUid(user);
    if (!uid) {
      return {
        ok: false,
        code: 'signed-out',
        message: '请先以游客身份进入。',
      };
    }

    const remaining = RATE_LIMIT_MS - (Date.now() - getLastSubmit(uid));
    if (remaining > 0) {
      return {
        ok: false,
        code: 'rate-limited',
        message: `请稍等 ${Math.ceil(remaining / 1000)} 秒后再留言。`,
      };
    }

    const profile = await getOrCreateUserProfile(uid);
    const nickname = profile.ok ? profile.data.nickname : '匿名访客';
    const timestamp = serverDate(cloudbase.client.database);

    await cloudbase.client.database.collection(COLLECTION).add({
      uid,
      nickname,
      content: validated.data,
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
      reply: '',
      repliedAt: null,
    });

    rememberSubmit(uid);
    return { ok: true, data: null };
  } catch {
    return databaseFailure();
  }
}
