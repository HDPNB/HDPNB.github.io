import { getCloudBaseClient } from '@/lib/cloudbase';
import type {
  AuthFailureCode,
  AuthResult,
  VisitorProfileRecord,
  VisitorSession,
} from '@/types/auth';

const PROFILE_STORAGE_KEY = 'hdp-cloudbase-visitor-profile';
const DEFAULT_NICKNAME = '匿名访客';

function authFailure(code: AuthFailureCode, message: string): AuthResult<never> {
  return { ok: false, code, message };
}

function friendlyAuthError(error: unknown): string {
  const detail =
    error && typeof error === 'object'
      ? `${'code' in error ? String(error.code) : ''} ${
          'message' in error ? String(error.message) : ''
        }`.toLowerCase()
      : '';

  if (detail.includes('domain') || detail.includes('origin') || detail.includes('非法来源')) {
    return '当前域名还没有加入 CloudBase Web 安全域名。';
  }
  if (
    detail.includes('anonymous') ||
    detail.includes('unimplemented') ||
    detail.includes('未开启')
  ) {
    return 'CloudBase 匿名登录尚未开启。';
  }
  if (detail.includes('network') || detail.includes('fetch')) {
    return '网络连接不太稳定，请稍后再试。';
  }
  return '游客身份操作没有成功，请稍后再试。';
}

function readProfile(uid: string): VisitorProfileRecord | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw) as Partial<VisitorProfileRecord>;
    if (profile.uid !== uid || typeof profile.nickname !== 'string') return null;
    return { uid, nickname: profile.nickname };
  } catch {
    return null;
  }
}

function writeProfile(profile: VisitorProfileRecord): boolean {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

function shortenUid(uid: string): string {
  if (uid.length <= 12) return uid;
  return `${uid.slice(0, 6)}…${uid.slice(-4)}`;
}

function createSession(uid: string): VisitorSession {
  const profile = readProfile(uid);
  return {
    uid,
    nickname: profile?.nickname || DEFAULT_NICKNAME,
    identity: '游客',
    shortUid: shortenUid(uid),
  };
}

function getUid(user: unknown): string | null {
  if (!user || typeof user !== 'object' || !('uid' in user)) return null;
  const uid = user.uid;
  return typeof uid === 'string' && uid.trim() ? uid : null;
}

function resultError(result: unknown): unknown {
  if (!result || typeof result !== 'object' || !('error' in result)) return null;
  return result.error || null;
}

export async function restoreVisitorSession(): Promise<AuthResult<VisitorSession>> {
  const cloudbase = await getCloudBaseClient();
  if (!cloudbase.ok) return authFailure(cloudbase.code, cloudbase.message);

  try {
    const user = await cloudbase.client.auth.getCurrentUser();
    const uid = getUid(user);
    if (!uid) return authFailure('signed-out', '尚未进入游客身份。');
    return { ok: true, data: createSession(uid) };
  } catch (error) {
    return authFailure('auth-error', friendlyAuthError(error));
  }
}

export async function signInAsVisitor(): Promise<AuthResult<VisitorSession>> {
  const cloudbase = await getCloudBaseClient();
  if (!cloudbase.ok) return authFailure(cloudbase.code, cloudbase.message);

  try {
    const existingUser = await cloudbase.client.auth.getCurrentUser();
    const existingUid = getUid(existingUser);
    if (existingUid) return { ok: true, data: createSession(existingUid) };

    const signInResult = await cloudbase.client.auth.signInAnonymously();
    const error = resultError(signInResult);
    if (error) return authFailure('auth-error', friendlyAuthError(error));

    const user = await cloudbase.client.auth.getCurrentUser();
    const uid = getUid(user);
    if (!uid) {
      return authFailure('auth-error', '没有读取到有效的游客身份，请稍后再试。');
    }
    return { ok: true, data: createSession(uid) };
  } catch (error) {
    return authFailure('auth-error', friendlyAuthError(error));
  }
}

export async function signOutVisitor(): Promise<AuthResult<null>> {
  const cloudbase = await getCloudBaseClient();
  if (!cloudbase.ok) return authFailure(cloudbase.code, cloudbase.message);

  try {
    await cloudbase.client.auth.signOut();
    return { ok: true, data: null };
  } catch (error) {
    return authFailure('auth-error', friendlyAuthError(error));
  }
}

export function updateVisitorNickname(
  uid: string,
  value: string,
): AuthResult<VisitorSession> {
  const nickname = value.trim().replace(/\s+/gu, ' ');
  const length = Array.from(nickname).length;
  const hasMarkup =
    /[<>]/u.test(nickname) ||
    /&(?:lt|gt|#0*60|#0*62|#x0*3c|#x0*3e);/iu.test(nickname);
  const hasControlCharacters = /[\u0000-\u001f\u007f]/u.test(nickname);

  if (length < 2 || length > 16) {
    return authFailure('invalid-nickname', '昵称需要保持在 2 到 16 个字符之间。');
  }
  if (hasMarkup || hasControlCharacters) {
    return authFailure('invalid-nickname', '昵称不能包含 HTML 标签或控制字符。');
  }

  const profile = { uid, nickname };
  if (!writeProfile(profile)) {
    return authFailure('auth-error', '昵称暂时无法保存在这台设备上。');
  }

  return {
    ok: true,
    data: {
      ...profile,
      identity: '游客',
      shortUid: shortenUid(uid),
    },
  };
}
