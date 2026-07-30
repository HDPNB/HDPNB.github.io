'use strict';

const crypto = require('node:crypto');
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({});
const database = app.database();
const collection = database.collection('site_reactions');

const ALLOWED_ACTIONS = new Set(['getReactions', 'react']);
const ALLOWED_PAGES = new Set([
  'home',
  'life',
  'learn',
  'projects',
  'about',
  'guestbook',
  'gallery',
]);
const ALLOWED_REACTIONS = ['healing', 'curious', 'cheer', 'miss'];
const ALLOWED_REACTION_SET = new Set(ALLOWED_REACTIONS);
const FORBIDDEN_INPUT_FIELDS = [
  'uid',
  'date',
  'counts',
  'collection',
  'where',
  'status',
  'role',
  'isAdmin',
  'permissions',
];
const REACTION_COOLDOWN_MS = 3_000;

function success(data) {
  return {
    ok: true,
    code: 'OK',
    data,
  };
}

function failure(code, message, extra) {
  return {
    ok: false,
    code,
    message,
    ...(extra || {}),
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
  console.error('[site-interactions] request failed', {
    stage,
    name,
    code,
  });
}

function chinaDateKey() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function getAuthenticatedUid(context) {
  const cloudbaseContext = cloudbase.getCloudbaseContext(context);
  const uid = cloudbaseContext && cloudbaseContext.TCB_UUID;
  return typeof uid === 'string' && uid.trim() ? uid.trim() : null;
}

function reactionDocumentId(uid, page, date) {
  return crypto
    .createHash('sha256')
    .update(`${uid}\n${page}\n${date}`, 'utf8')
    .digest('hex');
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

function firstDocument(value) {
  if (Array.isArray(value)) {
    return value[0] && typeof value[0] === 'object' ? value[0] : null;
  }
  return value && typeof value === 'object' ? value : null;
}

function validateInput(event) {
  if (!event || typeof event !== 'object') {
    return failure('INVALID_INPUT', '请求参数不符合要求。');
  }
  if (!ALLOWED_ACTIONS.has(event.action)) {
    return failure('INVALID_ACTION', '不支持的操作。');
  }
  for (const field of FORBIDDEN_INPUT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(event, field)) {
      return failure('INVALID_INPUT', '请求参数不符合要求。');
    }
  }
  if (
    typeof event.page !== 'string' ||
    event.page.length < 2 ||
    event.page.length > 20 ||
    !ALLOWED_PAGES.has(event.page)
  ) {
    return failure('INVALID_PAGE', '这个页面暂时不支持今日共鸣。');
  }
  if (
    event.action === 'react' &&
    (typeof event.reaction !== 'string' ||
      event.reaction.length > 16 ||
      !ALLOWED_REACTION_SET.has(event.reaction))
  ) {
    return failure('INVALID_REACTION', '请选择有效的共鸣类型。');
  }
  if (
    event.action === 'getReactions' &&
    Object.prototype.hasOwnProperty.call(event, 'reaction')
  ) {
    return failure('INVALID_INPUT', '请求参数不符合要求。');
  }
  return null;
}

async function getExistingReaction(uid, page, date) {
  const documentId = reactionDocumentId(uid, page, date);
  const result = await collection
    .where({ _id: documentId })
    .limit(1)
    .get();
  const record = firstDocument(result.data);
  if (
    !record ||
    record.uid !== uid ||
    record.page !== page ||
    record.date !== date ||
    !ALLOWED_REACTION_SET.has(record.reaction)
  ) {
    return {
      documentId,
      reaction: null,
      createdAt: null,
      lastReactedAt: null,
    };
  }
  return {
    documentId,
    reaction: record.reaction,
    createdAt: record.createdAt || null,
    lastReactedAt: parseDate(record.lastReactedAt),
  };
}

async function aggregateCounts(page, date) {
  const results = await Promise.all(
    ALLOWED_REACTIONS.map((reaction) =>
      collection.where({ page, date, reaction }).count(),
    ),
  );
  return Object.fromEntries(
    ALLOWED_REACTIONS.map((reaction, index) => [
      reaction,
      Number.isInteger(results[index] && results[index].total)
        ? results[index].total
        : 0,
    ]),
  );
}

async function getReactions(uid, page, date) {
  const current = await getExistingReaction(uid, page, date);
  const counts = await aggregateCounts(page, date);
  console.info('[site-interactions] getReactions completed', {
    page,
    hasCurrentReaction: Boolean(current.reaction),
  });
  return success({
    page,
    date,
    counts,
    currentReaction: current.reaction,
  });
}

async function react(uid, page, date, reaction) {
  const current = await getExistingReaction(uid, page, date);
  const now = new Date();

  if (
    current.reaction !== reaction &&
    current.lastReactedAt &&
    now.getTime() - current.lastReactedAt.getTime() < REACTION_COOLDOWN_MS
  ) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (REACTION_COOLDOWN_MS -
          (now.getTime() - current.lastReactedAt.getTime())) /
          1000,
      ),
    );
    return failure(
      'RATE_LIMITED',
      `请稍等 ${retryAfterSeconds} 秒再修改今天的共鸣。`,
      { retryAfterSeconds },
    );
  }

  let changed = false;
  if (current.reaction !== reaction) {
    const timestamp = database.serverDate();
    await collection.doc(current.documentId).set({
      uid,
      page,
      date,
      reaction,
      createdAt: current.createdAt || timestamp,
      updatedAt: timestamp,
      lastReactedAt: timestamp,
    });
    changed = true;
  }

  const counts = await aggregateCounts(page, date);
  console.info('[site-interactions] react completed', {
    page,
    reaction,
    changed,
  });
  return success({
    page,
    date,
    counts,
    currentReaction: reaction,
    changed,
  });
}

exports.main = async (event, context) => {
  const validationFailure = validateInput(event);
  if (validationFailure) return validationFailure;

  const uid = getAuthenticatedUid(context);
  if (!uid) {
    return failure('NOT_LOGGED_IN', '请先以游客身份进入，再留下今日共鸣。');
  }

  const date = chinaDateKey();
  try {
    if (event.action === 'getReactions') {
      return await getReactions(uid, event.page, date);
    }
    return await react(uid, event.page, date, event.reaction);
  } catch (error) {
    safeLogError(event.action, error);
    return failure('INTERACTION_UNAVAILABLE', '互动暂时没有连接上，请稍后再试。');
  }
};
