'use strict';

const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({});
const database = app.database();

const COLLECTION = 'user_images';
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 24;
const MAX_PAGE = 50;
const TEMP_URL_MAX_AGE_SECONDS = 20 * 60;
const TEMP_URL_TIMEOUT_MS = 8_000;
const FORBIDDEN_INPUT_FIELDS = [
  'uid',
  'status',
  'visibility',
  'fileId',
  'cloudPath',
];

function success(data) {
  return {
    ok: true,
    code: 'OK',
    data,
  };
}

function failure(code, message) {
  return {
    ok: false,
    code,
    message,
  };
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

  console.error('[public-gallery-images] request failed', {
    stage,
    name,
    code,
  });
}

function parseInteger(value, fallback, minimum, maximum) {
  if (value === undefined) return fallback;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    return null;
  }
  return value;
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

function isSafeText(value, minimum, maximum) {
  if (typeof value !== 'string') return false;
  const length = Array.from(value).length;
  return (
    length >= minimum &&
    length <= maximum &&
    !/[<>]/u.test(value) &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function isSafeHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeApprovedRecord(value) {
  if (!value || typeof value !== 'object') return null;
  const createdAt = parseDate(value.createdAt);
  const nickname =
    typeof value.nickname === 'string' ? value.nickname.trim() : '';
  const description =
    typeof value.description === 'string' ? value.description.trim() : '';
  if (
    typeof value._id !== 'string' ||
    !value._id ||
    value._id.length > 128 ||
    value.visibility !== 'public' ||
    value.status !== 'approved' ||
    !isSafeText(nickname, 2, 16) ||
    !isSafeText(description, 0, 100) ||
    typeof value.width !== 'number' ||
    !Number.isInteger(value.width) ||
    value.width < 1 ||
    value.width > 1920 ||
    typeof value.height !== 'number' ||
    !Number.isInteger(value.height) ||
    value.height < 1 ||
    value.height > 1920 ||
    typeof value.fileId !== 'string' ||
    !value.fileId.startsWith('cloud://') ||
    value.fileId.length > 1024 ||
    !createdAt
  ) {
    return null;
  }

  return {
    id: value._id,
    nickname,
    description,
    width: value.width,
    height: value.height,
    createdAt,
    fileId: value.fileId,
  };
}

async function listPublic(event) {
  for (const field of FORBIDDEN_INPUT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(event, field)) {
      return failure('INVALID_INPUT', '请求参数不符合要求。');
    }
  }

  const page = parseInteger(event.page, 1, 1, MAX_PAGE);
  const pageSize = parseInteger(
    event.pageSize,
    DEFAULT_PAGE_SIZE,
    1,
    MAX_PAGE_SIZE,
  );
  if (page === null || pageSize === null) {
    return failure(
      'INVALID_INPUT',
      `页码必须在 1～${MAX_PAGE} 之间，每页最多 ${MAX_PAGE_SIZE} 张图片。`,
    );
  }

  const offset = (page - 1) * pageSize;
  let records;
  try {
    const result = await database
      .collection(COLLECTION)
      .where({
        visibility: 'public',
        status: 'approved',
      })
      .field({
        _id: true,
        nickname: true,
        description: true,
        width: true,
        height: true,
        createdAt: true,
        visibility: true,
        status: true,
        fileId: true,
      })
      .orderBy('createdAt', 'desc')
      .skip(offset)
      .limit(pageSize)
      .get();
    records = Array.isArray(result.data) ? result.data : [];
  } catch (error) {
    safeLogError('database-query', error);
    return failure('GALLERY_UNAVAILABLE', '公开相册暂时无法读取，请稍后再试。');
  }

  const candidates = records
    .map(normalizeApprovedRecord)
    .filter(Boolean);
  if (candidates.length === 0) {
    console.info('[public-gallery-images] listPublic completed', {
      page,
      pageSize,
      queried: records.length,
      returned: 0,
    });
    return success({
      items: [],
      page,
      pageSize,
      hasMore: records.length === pageSize,
    });
  }

  let fileList;
  try {
    const tempUrlResult = await app.getTempFileURL(
      {
        fileList: candidates.map((item) => ({
          fileID: item.fileId,
          maxAge: TEMP_URL_MAX_AGE_SECONDS,
        })),
      },
      { timeout: TEMP_URL_TIMEOUT_MS },
    );
    fileList = Array.isArray(tempUrlResult.fileList)
      ? tempUrlResult.fileList
      : [];
  } catch (error) {
    safeLogError('temporary-url', error);
    return failure('GALLERY_UNAVAILABLE', '图片临时链接暂时无法生成，请稍后再试。');
  }

  const tempUrls = new Map();
  for (const item of fileList) {
    if (
      item &&
      typeof item === 'object' &&
      typeof item.fileID === 'string' &&
      (!item.code || item.code === 'SUCCESS') &&
      isSafeHttpsUrl(item.tempFileURL)
    ) {
      tempUrls.set(item.fileID, item.tempFileURL);
    }
  }

  const expiresAt = new Date(
    Date.now() + TEMP_URL_MAX_AGE_SECONDS * 1000,
  ).toISOString();
  const items = [];
  for (const candidate of candidates) {
    const tempUrl = tempUrls.get(candidate.fileId);
    if (!tempUrl) continue;
    items.push({
      id: candidate.id,
      nickname: candidate.nickname,
      description: candidate.description,
      width: candidate.width,
      height: candidate.height,
      createdAt: candidate.createdAt.toISOString(),
      tempUrl,
      expiresAt,
    });
  }

  if (items.length !== candidates.length) {
    console.warn('[public-gallery-images] some image URLs were skipped', {
      requested: candidates.length,
      returned: items.length,
    });
  }
  console.info('[public-gallery-images] listPublic completed', {
    page,
    pageSize,
    queried: records.length,
    returned: items.length,
  });

  return success({
    items,
    page,
    pageSize,
    hasMore: records.length === pageSize,
  });
}

exports.main = async (event) => {
  const input = event && typeof event === 'object' ? event : {};
  if (input.action !== 'listPublic') {
    return failure('INVALID_ACTION', '不支持的操作。');
  }

  try {
    return await listPublic(input);
  } catch (error) {
    safeLogError('unhandled', error);
    return failure('INTERNAL_ERROR', '公开相册暂时不可用，请稍后再试。');
  }
};
