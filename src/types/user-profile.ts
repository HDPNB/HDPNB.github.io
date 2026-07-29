export type ProfileSyncStatus = 'synced' | 'cached' | 'unavailable';

export interface UserProfileDocument {
  _id?: string;
  uid: string;
  nickname: string;
  loginType: 'ANONYMOUS';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfileState extends UserProfileDocument {
  syncStatus: ProfileSyncStatus;
  syncMessage: string;
}

export type UserProfileResult =
  | { ok: true; data: UserProfileState }
  | { ok: false; message: string };
