export type VisitorIdentity = '游客';

export interface VisitorProfileRecord {
  uid: string;
  nickname: string;
}

export interface VisitorSession extends VisitorProfileRecord {
  identity: VisitorIdentity;
  shortUid: string;
}

export type AuthFailureCode =
  | 'disabled'
  | 'unconfigured'
  | 'unavailable'
  | 'signed-out'
  | 'invalid-nickname'
  | 'auth-error';

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AuthFailureCode; message: string };
