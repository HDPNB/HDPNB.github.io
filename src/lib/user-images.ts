import {
  getCloudBaseClient,
  type CloudBaseDatabase,
} from '@/lib/cloudbase';
import { getOrCreateUserProfile } from '@/lib/user-profile';
import type {
  DisplayUserImage,
  PreparedUserImage,
  PublicGalleryImage,
  UploadUserImageInput,
  UserImageDocument,
  UserImagesResult,
  UserImageStatus,
  UserImageVisibility,
} from '@/types/user-images';

const COLLECTION = 'user_images';
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1920;
const WEBP_QUALITY = 0.82;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type DatabaseWithServerDate = CloudBaseDatabase & {
  serverDate(options?: { offset?: number }): unknown;
};

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

function serverDate(database: CloudBaseDatabase): unknown {
  return (database as DatabaseWithServerDate).serverDate();
}

function failure<T>(
  code: Exclude<UserImagesResult<T>, { ok: true }>['code'],
  message: string,
): UserImagesResult<T> {
  return { ok: false, code, message };
}

function getUid(user: unknown): string | null {
  if (!user || typeof user !== 'object' || !('uid' in user)) return null;
  const uid = user.uid;
  return typeof uid === 'string' && uid.trim() ? uid : null;
}

function validateDescription(value: string): UserImagesResult<string> {
  const description = value.trim().replace(/\s+/gu, ' ');
  const length = Array.from(description).length;
  const hasMarkup =
    /[<>]/u.test(description) ||
    /&(?:lt|gt|#0*60|#0*62|#x0*3c|#x0*3e);/iu.test(description);
  const hasControlCharacters =
    /[\u0000-\u001f\u007f]/u.test(description);

  if (length > 100) {
    return failure('invalid-description', '图片描述不能超过 100 个字符。');
  }
  if (hasMarkup || hasControlCharacters) {
    return failure(
      'invalid-description',
      '图片描述只能使用普通文本，不能包含 HTML 标签或控制字符。',
    );
  }
  return { ok: true, data: description };
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file);
    if (!bitmap.width || !bitmap.height) {
      bitmap.close();
      throw new Error('invalid-image-size');
    }
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('image-decode-failed'));
      element.src = objectUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('invalid-image-size');
    }
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function canvasToWebP(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.type !== 'image/webp') {
          reject(new Error('webp-encode-failed'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      WEBP_QUALITY,
    );
  });
}

export async function prepareUserImage(
  file: File,
): Promise<UserImagesResult<PreparedUserImage>> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return failure(
      'invalid-file',
      '请选择 JPEG、PNG 或 WebP 格式的图片。',
    );
  }
  if (!file.size || file.size > MAX_FILE_SIZE) {
    return failure('invalid-file', '原始图片不能超过 5MB。');
  }

  let decoded: DecodedImage | undefined;
  try {
    decoded = await decodeImage(file);
    const scale = Math.min(
      1,
      MAX_IMAGE_EDGE / Math.max(decoded.width, decoded.height),
    );
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('canvas-unavailable');
    context.fillStyle = '#f4f1e8';
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.source, 0, 0, width, height);
    const blob = await canvasToWebP(canvas);
    canvas.width = 0;
    canvas.height = 0;
    return {
      ok: true,
      data: {
        blob,
        originalSize: file.size,
        compressedSize: blob.size,
        width,
        height,
      },
    };
  } catch {
    return failure(
      'invalid-file',
      '这张图片无法正常解码或压缩，请换一张图片再试。',
    );
  } finally {
    decoded?.cleanup();
  }
}

function randomToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function createCloudPath(uid: string): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `user-images/${uid}/${year}/${month}/${now.getTime()}-${randomToken()}.webp`;
}

function parseDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (value && typeof value === 'object' && '$date' in value) {
    return parseDate((value as { $date: unknown }).$date);
  }
  return new Date();
}

function parseStrictDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value && typeof value === 'object' && '$date' in value) {
    return parseStrictDate((value as { $date: unknown }).$date);
  }
  return null;
}

function isSafeTempUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizePublicGalleryImage(value: unknown): PublicGalleryImage | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const createdAt = parseStrictDate(item.createdAt);
  const expiresAt = parseStrictDate(item.expiresAt);
  if (
    typeof item.id !== 'string' ||
    !item.id.trim() ||
    typeof item.nickname !== 'string' ||
    typeof item.description !== 'string' ||
    typeof item.width !== 'number' ||
    !Number.isFinite(item.width) ||
    item.width <= 0 ||
    typeof item.height !== 'number' ||
    !Number.isFinite(item.height) ||
    item.height <= 0 ||
    !createdAt ||
    !expiresAt ||
    !isSafeTempUrl(item.tempUrl)
  ) {
    return null;
  }

  return {
    id: item.id,
    nickname: item.nickname,
    description: item.description,
    width: Math.round(item.width),
    height: Math.round(item.height),
    createdAt,
    tempUrl: item.tempUrl,
    expiresAt,
  };
}

function normalizeDocument(value: unknown): UserImageDocument | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const visibility = item.visibility as UserImageVisibility;
  const status = item.status as UserImageStatus;
  if (
    typeof item._id !== 'string' ||
    typeof item.uid !== 'string' ||
    typeof item.nickname !== 'string' ||
    typeof item.description !== 'string' ||
    typeof item.fileId !== 'string' ||
    typeof item.cloudPath !== 'string' ||
    item.mimeType !== 'image/webp' ||
    typeof item.originalSize !== 'number' ||
    typeof item.compressedSize !== 'number' ||
    typeof item.width !== 'number' ||
    typeof item.height !== 'number' ||
    !['public', 'private'].includes(visibility) ||
    !['pending', 'approved', 'rejected'].includes(status)
  ) {
    return null;
  }

  return {
    _id: item._id,
    uid: item.uid,
    nickname: item.nickname,
    description: item.description,
    fileId: item.fileId,
    cloudPath: item.cloudPath,
    mimeType: 'image/webp',
    originalSize: item.originalSize,
    compressedSize: item.compressedSize,
    width: item.width,
    height: item.height,
    visibility,
    status,
    createdAt: parseDate(item.createdAt),
    updatedAt: parseDate(item.updatedAt),
    reviewedAt: item.reviewedAt ? parseDate(item.reviewedAt) : null,
    reviewedBy: typeof item.reviewedBy === 'string' ? item.reviewedBy : null,
  };
}

async function attachSignedUrls(
  documents: UserImageDocument[],
): Promise<DisplayUserImage[]> {
  const cloudbase = await getCloudBaseClient();
  if (!cloudbase.ok) {
    return documents.map((document) => ({ ...document, displayUrl: null }));
  }

  return Promise.all(
    documents.map(async (document) => {
      try {
        const result = await cloudbase.client.storage.createSignedUrl(
          document.fileId,
          30 * 60,
        );
        return {
          ...document,
          displayUrl: result.error ? null : result.data.signedUrl,
        };
      } catch {
        return { ...document, displayUrl: null };
      }
    }),
  );
}

export async function uploadUserImage(
  input: UploadUserImageInput,
): Promise<UserImagesResult<null>> {
  const description = validateDescription(input.description);
  if (!description.ok) return description;
  if (!['public', 'private'].includes(input.visibility)) {
    return failure('invalid-description', '请选择有效的图片可见范围。');
  }

  const cloudbase = await getCloudBaseClient();
  if (!cloudbase.ok) {
    return failure('disabled', '图片上传功能暂时未开放。');
  }

  let uploadedFileId = '';
  try {
    const user = await cloudbase.client.auth.getCurrentUser();
    const uid = getUid(user);
    if (!uid) {
      return failure('signed-out', '请先以游客身份进入，再上传图片。');
    }

    const profile = await getOrCreateUserProfile(uid);
    const nickname = profile.ok ? profile.data.nickname : '匿名访客';
    const cloudPath = createCloudPath(uid);

    input.onProgress?.(58, '正在上传压缩后的图片…');
    const upload = await cloudbase.client.storage.upload(
      cloudPath,
      input.image.blob,
      {
        contentType: 'image/webp',
        upsert: false,
      },
    );
    if (upload.error) {
      return failure('storage-error', '图片没有上传成功，请稍后再试。');
    }
    uploadedFileId = upload.data.id;
    input.onProgress?.(86, '正在保存图片信息…');

    const timestamp = serverDate(cloudbase.client.database);
    await cloudbase.client.database.collection(COLLECTION).add({
      uid,
      nickname,
      description: description.data,
      fileId: upload.data.id,
      cloudPath,
      mimeType: 'image/webp',
      originalSize: input.image.originalSize,
      compressedSize: input.image.compressedSize,
      width: input.image.width,
      height: input.image.height,
      visibility: input.visibility,
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    input.onProgress?.(100, '图片已经安全送达');
    return { ok: true, data: null };
  } catch {
    if (uploadedFileId) {
      try {
        await cloudbase.client.storage.remove([uploadedFileId]);
      } catch {
        console.warn(
          '[user-images] 刚上传文件的自动清理未完成，请按运维文档检查孤立文件。',
        );
      }
    }
    return failure(
      uploadedFileId ? 'database-error' : 'storage-error',
      uploadedFileId
        ? '图片信息没有保存成功，已尝试清理刚上传的云文件。'
        : '图片上传失败，请检查网络后再试。',
    );
  }
}

export async function loadPublicUserImages(): Promise<
  UserImagesResult<PublicGalleryImage[]>
> {
  const cloudbase = await getCloudBaseClient();
  if (!cloudbase.ok) {
    return failure('disabled', '访客相册暂时未开放。');
  }

  try {
    const response = await cloudbase.client.app.callFunction({
      name: 'public-gallery-images',
      data: { action: 'listPublic' },
      parse: true,
    });
    const result = response.result;
    if (!result || typeof result !== 'object') {
      return failure('function-error', '公开相册返回了无法识别的数据，请稍后再试。');
    }

    const payload = result as Record<string, unknown>;
    if (payload.ok !== true) {
      return failure('function-error', '公开相册暂时无法打开，请稍后再试。');
    }
    if (
      !payload.data ||
      typeof payload.data !== 'object' ||
      !Array.isArray((payload.data as Record<string, unknown>).items)
    ) {
      return failure('function-error', '公开相册返回了无法识别的数据，请稍后再试。');
    }

    const rawItems = (payload.data as { items: unknown[] }).items.slice(0, 24);
    const images = rawItems
      .map(normalizePublicGalleryImage)
      .filter((item): item is PublicGalleryImage => Boolean(item));
    return { ok: true, data: images };
  } catch {
    return failure('function-error', '访客相册暂时无法打开，请稍后再试。');
  }
}

export async function loadOwnUserImages(): Promise<
  UserImagesResult<DisplayUserImage[]>
> {
  const cloudbase = await getCloudBaseClient();
  if (!cloudbase.ok) {
    return failure('disabled', '个人图片区域暂时未开放。');
  }

  try {
    const user = await cloudbase.client.auth.getCurrentUser();
    const uid = getUid(user);
    if (!uid) {
      return failure('signed-out', '请先以游客身份进入，查看自己的图片。');
    }
    const result = await cloudbase.client.database
      .collection(COLLECTION)
      .where({ uid })
      .orderBy('createdAt', 'desc')
      .limit(48)
      .get();
    const documents = result.data
      .map(normalizeDocument)
      .filter((item): item is UserImageDocument => Boolean(item));
    return { ok: true, data: await attachSignedUrls(documents) };
  } catch {
    return failure('database-error', '自己的图片暂时没有加载出来，请稍后再试。');
  }
}
