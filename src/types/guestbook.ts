export type GuestbookStatus = 'pending' | 'approved' | 'rejected';

export interface GuestbookMessageDocument {
  _id: string;
  uid: string;
  nickname: string;
  content: string;
  status: GuestbookStatus;
  createdAt: Date;
  updatedAt: Date;
  reply: string;
  repliedAt: Date | null;
}

export type GuestbookResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: 'disabled' | 'signed-out' | 'invalid-content' | 'rate-limited' | 'database-error';
      message: string;
    };
