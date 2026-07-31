'use strict';

const crypto = require('node:crypto');
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({});
const database = app.database();
const admins = database.collection('admins');
const reviewTokens = database.collection('admin_review_tokens');

const REVIEW_TOKEN_TTL_MS = 15 * 60 * 1000;
const TEMP_URL_MAX_AGE_SECONDS = 10 * 60;
const MAX_PER_KIND = 12;
const ALLOWED_ACTIONS = new Set([
  'listPending',
  'listContent',
  'reviewContent',
  'deleteContent',
]);
const ALLOWED_KINDS = new Set(['guestbook', 'image', 'star', 'bottle']);
const ALLOWED_STATUSES = new Set([
  'pending',
  'approved',
  'rejected',
  'hidden',
  'archived',
]);
const ALLOWED_TARGET_STATUSES = new Set([
  'approved',
  'rejected',
  'hidden',
  'archived',
]);
const KIND_CONFIG = Object.freeze({
  guestbook: { collection: 'guestbook_messages' },
  image: { collection: 'user_images' },
  star: { collection: 'visitor_stars' },
  bottle: { collection: 'drift_bottles' },
});

function success(data) {
  return { ok: true, code: 'OK', data };
}

function failure(code, message) {
  return { ok: false, code, message };
}

function safeLogError(stage, error) {
  const name =
    error && typeof error === 'object' && typeof error.name === 'string'
      ? error.name.slice(0, 80)
      : 'UnknownError';
  const code =
    error && typeof error === 'object' && typeof error.code === 'string'
      ? error.code.slice(0, 80)
      : 'UNKNOWN';
  console.error('[admin-content] request failed', { stage, name, code });
}

function getAuthenticatedUid(context) {
  const cloudbaseContext = cloudbase.getCloudbaseContext(context);
  const uid = cloudbaseContext && cloudbaseContext.TCB_UUID;
  return typeof uid === 'string' && uid.trim() ? uid.trim() : null;
}

function firstDocument(value) {
  if (Array.isArray(value)) {
    return value[0] && typeof value[0] === 'object' ? value[0] : null;
  }
  return value && typeof value === 'object' ? value : null;
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value && typeof value === 'object' && '$date' in value) {
    return parseDate(value.$date);
  }
  return null;
}

function safeText(value, maximum, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  if (
    !text ||
    text.length > maximum ||
    /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)
  ) {
    return fallback;
  }
  return text;
}

function tokenDocumentId(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function createReviewToken() {
  return crypto.randomBytes(24).toString('base64url');
}

async function isAdministrator(uid) {
  try {
    const direct = firstDocument((await admins.doc(uid).get()).data);
    if (direct) return true;
  } catch {
    // 兼容 admins 使用 uid 字段、但文档 ID 不是 uid 的既有配置。
  }
  const query = await admins.where({ uid }).limit(1).get();
  return Boolean(firstDocument(query.data));
}

function validateListEvent(event) {
  const allowedKeys =
    event.action === 'listPending'
      ? new Set(['action', 'kind'])
      : new Set(['action', 'kind', 'status']);
  if (
    Object.keys(event).some((key) => !allowedKeys.has(key)) ||
    (event.kind !== undefined &&
      (typeof event.kind !== 'string' || !ALLOWED_KINDS.has(event.kind))) ||
    (event.action === 'listContent' &&
      (typeof event.status !== 'string' ||
        !ALLOWED_STATUSES.has(event.status)))
  ) {
    return failure('INVALID_INPUT', '内容列表参数不符合要求');
  }
  return null;
}

function validateEvent(event) {
  if (!event || typeof event !== 'object' || !ALLOWED_ACTIONS.has(event.action)) {
    return failure('INVALID_ACTION', '不支持的内容管理操作');
  }
  if (event.action === 'listPending' || event.action === 'listContent') {
    return validateListEvent(event);
  }
  const allowedKeys =
    event.action === 'reviewContent'
      ? new Set(['action', 'reviewToken', 'status'])
      : new Set(['action', 'reviewToken']);
  if (
    Object.keys(event).some((key) => !allowedKeys.has(key)) ||
    typeof event.reviewToken !== 'string' ||
    event.reviewToken.length < 30 ||
    event.reviewToken.length > 80 ||
    !/^[A-Za-z0-9_-]+$/u.test(event.reviewToken) ||
    (event.action === 'reviewContent' &&
      (typeof event.status !== 'string' ||
        !ALLOWED_TARGET_STATUSES.has(event.status)))
  ) {
    return failure('INVALID_INPUT', '内容管理参数不符合要求');
  }
  return null;
}

async function createBoundReviewToken(
  adminUid,
  kind,
  targetId,
  expectedStatus,
) {
  const token = createReviewToken();
  const now = new Date();
  await reviewTokens.doc(tokenDocumentId(token)).set({
    adminUid,
    kind,
    targetId,
    expectedStatus,
    createdAt: now,
    expiresAt: new Date(now.getTime() + REVIEW_TOKEN_TTL_MS),
  });
  return token;
}

function normalizeManagedContent(kind, record, expectedStatus) {
  if (
    !record ||
    typeof record !== 'object' ||
    typeof record._id !== 'string' ||
    record.status !== expectedStatus
  ) {
    return null;
  }
  const createdAt = parseDate(record.createdAt);
  if (!createdAt) return null;
  const base = {
    kind,
    status: expectedStatus,
    createdAt: createdAt.toISOString(),
  };
  if (kind === 'guestbook') {
    const nickname = safeText(record.nickname, 16, '匿名访客');
    const content = safeText(record.content, 300);
    return content ? { ...base, nickname, content } : null;
  }
  if (kind === 'star') {
    const nickname = safeText(record.nickname, 16, '匿名访客');
    const content = safeText(record.message, 30);
    const mood = safeText(record.mood, 16);
    return content ? { ...base, nickname, content, meta: mood } : null;
  }
  if (kind === 'bottle') {
    const content = safeText(record.content, 80);
    const category = safeText(record.category, 20);
    return content ? { ...base, content, meta: category } : null;
  }
  if (kind === 'image') {
    const nickname = safeText(record.nickname, 16, '匿名访客');
    const content = safeText(record.description, 100, '没有填写图片说明');
    if (
      typeof record.fileId !== 'string' ||
      !record.fileId.startsWith('cloud://') ||
      record.fileId.length > 1024
    ) {
      return null;
    }
    return {
      ...base,
      nickname,
      content,
      meta: record.visibility === 'private' ? '仅自己可见' : '公开展示',
      fileId: record.fileId,
    };
  }
  return null;
}

async function addImagePreview(items) {
  const images = items.filter(
    (item) => item.kind === 'image' && typeof item.fileId === 'string',
  );
  if (images.length === 0) return;
  try {
    const result = await app.getTempFileURL({
      fileList: images.map((item) => ({
        fileID: item.fileId,
        maxAge: TEMP_URL_MAX_AGE_SECONDS,
      })),
    });
    const urls = new Map(
      (Array.isArray(result.fileList) ? result.fileList : [])
        .filter(
          (item) =>
            item &&
            typeof item.fileID === 'string' &&
            typeof item.tempFileURL === 'string' &&
            item.tempFileURL.startsWith('https://'),
        )
        .map((item) => [item.fileID, item.tempFileURL]),
    );
    images.forEach((item) => {
      item.previewUrl = urls.get(item.fileId) || null;
    });
  } catch (error) {
    safeLogError('image-preview', error);
  }
}

async function listContent(adminUid, requestedKind, status) {
  const kinds = requestedKind ? [requestedKind] : [...ALLOWED_KINDS];
  const candidates = [];
  for (const kind of kinds) {
    if (status === 'archived' && kind !== 'bottle') continue;
    const result = await database
      .collection(KIND_CONFIG[kind].collection)
      .where({ status })
      .orderBy('createdAt', 'desc')
      .limit(MAX_PER_KIND)
      .get();
    for (const record of Array.isArray(result.data) ? result.data : []) {
      const item = normalizeManagedContent(kind, record, status);
      if (item) candidates.push({ ...item, targetId: record._id });
    }
  }
  await addImagePreview(candidates);
  const items = [];
  for (const candidate of candidates) {
    const reviewToken = await createBoundReviewToken(
      adminUid,
      candidate.kind,
      candidate.targetId,
      candidate.status,
    );
    const { fileId: _fileId, targetId: _targetId, ...safe } = candidate;
    items.push({ ...safe, reviewToken });
  }
  return success({
    items,
    status,
    expiresAt: new Date(Date.now() + REVIEW_TOKEN_TTL_MS).toISOString(),
  });
}

async function resolveReviewTarget(adminUid, token) {
  const tokenId = tokenDocumentId(token);
  const tokenRecord = firstDocument((await reviewTokens.doc(tokenId).get()).data);
  const expiresAt = parseDate(tokenRecord && tokenRecord.expiresAt);
  if (
    !tokenRecord ||
    tokenRecord.adminUid !== adminUid ||
    !ALLOWED_KINDS.has(tokenRecord.kind) ||
    !ALLOWED_STATUSES.has(tokenRecord.expectedStatus) ||
    typeof tokenRecord.targetId !== 'string' ||
    !expiresAt ||
    expiresAt.getTime() <= Date.now()
  ) {
    return {
      ok: false,
      response: failure(
        'REVIEW_TOKEN_EXPIRED',
        '本次内容管理凭据已经失效，请刷新列表后重试',
      ),
    };
  }
  const config = KIND_CONFIG[tokenRecord.kind];
  const targetRef = database.collection(config.collection).doc(tokenRecord.targetId);
  const target = firstDocument((await targetRef.get()).data);
  if (!target || target.status !== tokenRecord.expectedStatus) {
    return {
      ok: false,
      response: failure('CONTENT_CHANGED', '这条内容已经变化，请刷新列表'),
    };
  }
  return { ok: true, tokenId, tokenRecord, targetRef, target };
}

async function cleanupReviewToken(tokenId) {
  try {
    await reviewTokens.doc(tokenId).remove();
  } catch (error) {
    safeLogError('token-cleanup', error);
  }
}

async function reviewContent(adminUid, token, status) {
  const resolved = await resolveReviewTarget(adminUid, token);
  if (!resolved.ok) return resolved.response;
  if (status === 'archived' && resolved.tokenRecord.kind !== 'bottle') {
    return failure('INVALID_STATUS', '只有漂流瓶可以进入归档状态');
  }

  const now = new Date();
  const updateData = {
    status,
    reviewedAt: now,
    reviewedBy: adminUid,
    updatedAt: now,
  };
  if (resolved.tokenRecord.kind === 'bottle') {
    if (status === 'approved') {
      updateData.deliveryCount = Number.isFinite(resolved.target.deliveryCount)
        ? Math.max(0, Math.floor(resolved.target.deliveryCount))
        : 0;
      updateData.lastDeliveredAt =
        parseDate(resolved.target.lastDeliveredAt) || null;
      updateData.nextAvailableAt = now;
      updateData.archivedAt = null;
    } else if (status === 'archived') {
      updateData.nextAvailableAt = null;
      updateData.archivedAt = now;
    }
  }
  await resolved.targetRef.update(updateData);
  await cleanupReviewToken(resolved.tokenId);
  return success({ kind: resolved.tokenRecord.kind, status });
}

async function deleteContent(adminUid, token) {
  const resolved = await resolveReviewTarget(adminUid, token);
  if (!resolved.ok) return resolved.response;
  if (resolved.tokenRecord.kind === 'image') {
    const fileId = resolved.target.fileId;
    if (
      typeof fileId !== 'string' ||
      !fileId.startsWith('cloud://') ||
      fileId.length > 1024
    ) {
      return failure('INVALID_FILE', '图片文件信息无效，未执行删除');
    }
    const deleted = await app.deleteFile({ fileList: [fileId] });
    const fileResult =
      deleted && Array.isArray(deleted.fileList) ? deleted.fileList[0] : null;
    if (!fileResult || (fileResult.code && fileResult.code !== 'SUCCESS')) {
      return failure('STORAGE_DELETE_FAILED', '图片文件删除失败，数据库记录已保留');
    }
  }
  await resolved.targetRef.remove();
  await cleanupReviewToken(resolved.tokenId);
  return success({ kind: resolved.tokenRecord.kind, deleted: true });
}

exports.main = async (event, context) => {
  const validationFailure = validateEvent(event);
  if (validationFailure) return validationFailure;
  const uid = getAuthenticatedUid(context);
  if (!uid) return failure('NOT_LOGGED_IN', '请先登录');
  try {
    if (!(await isAdministrator(uid))) {
      return failure('NOT_ADMIN', '当前身份没有内容管理权限');
    }
    if (event.action === 'listPending') {
      return await listContent(uid, event.kind, 'pending');
    }
    if (event.action === 'listContent') {
      return await listContent(uid, event.kind, event.status);
    }
    if (event.action === 'deleteContent') {
      return await deleteContent(uid, event.reviewToken);
    }
    return await reviewContent(uid, event.reviewToken, event.status);
  } catch (error) {
    safeLogError(event.action, error);
    return failure(
      'ADMIN_CONTENT_UNAVAILABLE',
      '内容管理暂时无法连接，请稍后再试',
    );
  }
};
