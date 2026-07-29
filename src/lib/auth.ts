import { getCloudBaseClient } from '@/lib/cloudbase';
import { DEFAULT_NICKNAME, getCachedNickname } from '@/lib/user-profile';
import type {
  AuthFailureCode,
  AuthResult,
  VisitorSession,
} from '@/types/auth';

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

function shortenUid(uid: string): string {
  if (uid.length <= 12) return uid;
  return `${uid.slice(0, 6)}…${uid.slice(-4)}`;
}

function createSession(uid: string): VisitorSession {
  return {
    uid,
    nickname: getCachedNickname(uid) || DEFAULT_NICKNAME,
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
