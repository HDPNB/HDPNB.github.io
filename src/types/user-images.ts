export type UserImageVisibility = 'public' | 'private';
export type UserImageStatus = 'pending' | 'approved' | 'rejected';

export interface UserImageDocument {
  _id: string;
  uid: string;
  nickname: string;
  description: string;
  fileId: string;
  cloudPath: string;
  mimeType: 'image/webp';
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  visibility: UserImageVisibility;
  status: UserImageStatus;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
}

export interface DisplayUserImage extends UserImageDocument {
  displayUrl: string | null;
}

export interface PublicGalleryImage {
  id: string;
  nickname: string;
  description: string;
  width: number;
  height: number;
  createdAt: Date;
  tempUrl: string;
  expiresAt: Date;
}

export interface PreparedUserImage {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

export interface UploadUserImageInput {
  image: PreparedUserImage;
  description: string;
  visibility: UserImageVisibility;
  onProgress?: (progress: number, label: string) => void;
}

export type UserImagesFailureCode =
  | 'disabled'
  | 'signed-out'
  | 'invalid-file'
  | 'invalid-description'
  | 'storage-error'
  | 'database-error'
  | 'function-error';

export type UserImagesResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: UserImagesFailureCode; message: string };
