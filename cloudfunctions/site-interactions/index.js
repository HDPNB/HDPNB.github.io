'use strict';

const crypto = require('node:crypto');
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({});
const database = app.database();
const reactionCollection = database.collection('site_reactions');
const dailyCollection = database.collection('daily_interactions');
const starCollection = database.collection('visitor_stars');
const userCollection = database.collection('users');
const bottleCollection = database.collection('drift_bottles');
const bottleResponseCollection = database.collection('drift_bottle_responses');
const capsuleCollection = database.collection('time_capsules');
const limitCollection = database.collection('interaction_limits');

const ALLOWED_ACTIONS = new Set([
  'getReactions',
  'react',
  'drawFortune',
  'drawMemoryCard',
  'createStar',
  'getPublicStars',
  'getMyStars',
  'createBottle',
  'drawBottle',
  'respondBottle',
  'getMyBottles',
  'createCapsule',
  'getMyCapsules',
  'openCapsule',
  'deleteCapsule',
]);
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
const REACTION_COOLDOWN_MS = 3_000;
const DAILY_DRAW_LIMIT = 3;
const DAILY_POOL_SIZES = Object.freeze({
  drawFortune: 60,
  drawMemoryCard: 60,
});
const STAR_MOODS = new Set(['healing', 'miss', 'happy', 'calm', 'hope', 'cheer']);
const STAR_COLORS = new Set(['sage', 'gold', 'blue', 'rose', 'cream']);
const BOTTLE_CATEGORIES = new Set([
  'mood',
  'unsaid',
  'blessing',
  'worry',
  'good-news',
]);
const BOTTLE_RESPONSES = new Set(['hug', 'received', 'cheer', 'happy-for-you', 'wish']);
const BOTTLE_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const BOTTLE_MAX_DELIVERIES = 40;
const BOTTLE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const BOTTLE_QUERY_LIMIT = 24;
const BOTTLE_RECENT_LIMIT = 12;
const CAPSULE_LIMIT = 10;

class InteractionError extends Error {
  constructor(code, message, data) {
    super(message);
    this.name = 'InteractionError';
    this.code = code;
    this.data = data;
  }
}

function success(data) {
  return { ok: true, code: 'OK', data };
}

function failure(code, message, extra) {
  return { ok: false, code, message, ...(extra || {}) };
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
  console.error('[site-interactions] request failed', { stage, name, code });
}

function chinaDateKey(now = new Date()) {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function getAuthenticatedUid(context) {
  const cloudbaseContext = cloudbase.getCloudbaseContext(context);
  const uid = cloudbaseContext && cloudbaseContext.TCB_UUID;
  return typeof uid === 'string' && uid.trim() ? uid.trim() : null;
}

function hashDocumentId(...parts) {
  return crypto
    .createHash('sha256')
    .update(parts.join('\n'), 'utf8')
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
    return failure('INVALID_INPUT', '请求参数不符合要求');
  }
  if (!ALLOWED_ACTIONS.has(event.action)) {
    return failure('INVALID_ACTION', '不支持的操作');
  }

  if (event.action === 'getReactions' || event.action === 'react') {
    const allowedKeys =
      event.action === 'react'
        ? new Set(['action', 'page', 'reaction'])
        : new Set(['action', 'page']);
    if (Object.keys(event).some((key) => !allowedKeys.has(key))) {
      return failure('INVALID_INPUT', '请求参数不符合要求');
    }
    if (
      typeof event.page !== 'string' ||
      event.page.length < 2 ||
      event.page.length > 20 ||
      !ALLOWED_PAGES.has(event.page)
    ) {
      return failure('INVALID_PAGE', '这个页面暂时不支持今日共鸣');
    }
    if (
      event.action === 'react' &&
      (typeof event.reaction !== 'string' ||
        event.reaction.length > 16 ||
        !ALLOWED_REACTION_SET.has(event.reaction))
    ) {
      return failure('INVALID_REACTION', '请选择有效的共鸣类型');
    }
    return null;
  }

  if (event.action === 'drawFortune' || event.action === 'drawMemoryCard') {
    const allowedKeys =
      event.mode === 'draw'
        ? new Set(['action', 'mode', 'requestId'])
        : new Set(['action', 'mode']);
    if (
      Object.keys(event).some((key) => !allowedKeys.has(key)) ||
      (event.mode !== 'get' && event.mode !== 'draw') ||
      (event.mode === 'draw' &&
        (typeof event.requestId !== 'string' ||
          event.requestId.length < 20 ||
          event.requestId.length > 80 ||
          !/^[A-Za-z0-9_-]+$/u.test(event.requestId)))
    ) {
      return failure('INVALID_INPUT', '请选择有效的卡片操作');
    }
  }
  if (event.action === 'createStar') {
    const allowedKeys = new Set(['action', 'message', 'mood', 'color']);
    if (
      Object.keys(event).some((key) => !allowedKeys.has(key)) ||
      typeof event.message !== 'string' ||
      typeof event.mood !== 'string' ||
      typeof event.color !== 'string'
    ) {
      return failure('INVALID_INPUT', '请完整填写星星内容');
    }
  }
  if (event.action === 'getPublicStars' || event.action === 'getMyStars') {
    if (Object.keys(event).some((key) => key !== 'action')) {
      return failure('INVALID_INPUT', '请求参数不符合要求');
    }
  }
  if (event.action === 'createBottle') {
    const allowedKeys = new Set(['action', 'content', 'category']);
    if (
      Object.keys(event).some((key) => !allowedKeys.has(key)) ||
      typeof event.content !== 'string' ||
      typeof event.category !== 'string'
    ) {
      return failure('INVALID_INPUT', '请完整填写漂流纸条');
    }
  }
  if (event.action === 'drawBottle') {
    const allowedKeys = new Set(['action', 'requestId']);
    if (
      Object.keys(event).some((key) => !allowedKeys.has(key)) ||
      typeof event.requestId !== 'string' ||
      event.requestId.length < 20 ||
      event.requestId.length > 80 ||
      !/^[A-Za-z0-9_-]+$/u.test(event.requestId)
    ) {
      return failure('INVALID_INPUT', '漂流瓶请求参数不符合要求');
    }
  }
  if (event.action === 'getMyBottles') {
    if (Object.keys(event).some((key) => key !== 'action')) {
      return failure('INVALID_INPUT', '请求参数不符合要求');
    }
  }
  if (event.action === 'respondBottle') {
    const allowedKeys = new Set(['action', 'bottleToken', 'response']);
    if (
      Object.keys(event).some((key) => !allowedKeys.has(key)) ||
      typeof event.bottleToken !== 'string' ||
      typeof event.response !== 'string'
    ) {
      return failure('INVALID_INPUT', '请选择有效的固定回应');
    }
  }
  if (event.action === 'createCapsule') {
    const allowedKeys = new Set(['action', 'title', 'content', 'unlockAt']);
    if (
      Object.keys(event).some((key) => !allowedKeys.has(key)) ||
      typeof event.title !== 'string' ||
      typeof event.content !== 'string' ||
      typeof event.unlockAt !== 'string'
    ) {
      return failure('INVALID_INPUT', '请完整填写时光胶囊');
    }
  }
  if (event.action === 'getMyCapsules') {
    if (Object.keys(event).some((key) => key !== 'action')) {
      return failure('INVALID_INPUT', '请求参数不符合要求');
    }
  }
  if (event.action === 'openCapsule' || event.action === 'deleteCapsule') {
    const allowedKeys = new Set(['action', 'capsuleToken']);
    if (
      Object.keys(event).some((key) => !allowedKeys.has(key)) ||
      typeof event.capsuleToken !== 'string'
    ) {
      return failure('INVALID_INPUT', '胶囊凭据无效');
    }
  }
  return null;
}

function sanitizePlainText(value, min, max) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (
    text.length < min ||
    text.length > max ||
    /[<>\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)
  ) {
    return null;
  }
  return text;
}

function normalizeDateForResponse(value) {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
}

async function getNickname(uid) {
  const result = await userCollection.where({ uid }).limit(1).get();
  const profile = firstDocument(result.data);
  const nickname = sanitizePlainText(profile && profile.nickname, 2, 16);
  return nickname || '匿名访客';
}

async function createStar(uid, date, event) {
  const message = sanitizePlainText(event.message, 1, 30);
  if (!message) return failure('INVALID_CONTENT', '星星上的话需要是 1～30 个纯文本字符');
  if (!STAR_MOODS.has(event.mood) || !STAR_COLORS.has(event.color)) {
    return failure('INVALID_INPUT', '请选择有效的心情和星星颜色');
  }
  const nickname = await getNickname(uid);
  const dailyId = hashDocumentId(uid, 'createStar', date);
  const starId = hashDocumentId(uid, 'visitorStar', date);
  try {
    const transactionResult = await database.runTransaction(async (transaction) => {
      const dailyRef = transaction.collection('daily_interactions').doc(dailyId);
      const dailyResult = await dailyRef.get();
      const daily = firstDocument(dailyResult.data);
      if (
        daily &&
        daily.uid === uid &&
        daily.date === date &&
        daily.action === 'createStar' &&
        Number(daily.count) >= 1
      ) {
        throw new InteractionError(
          'LIMIT_REACHED',
          '今天已经留下了一颗星星，明天再来看看',
        );
      }
      const now = new Date();
      await transaction.collection('visitor_stars').doc(starId).set({
        data: {
          uid,
          nickname,
          message,
          mood: event.mood,
          color: event.color,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
          reviewedAt: null,
          reviewedBy: null,
        },
      });
      await dailyRef.set({
        data: {
          uid,
          date,
          action: 'createStar',
          count: 1,
          results: ['submitted'],
          createdAt: daily && daily.createdAt ? daily.createdAt : now,
          updatedAt: now,
        },
      });
      return { date, todayCount: 1, remainingCount: 0, limit: 1 };
    });
    return success(
      transactionResult && transactionResult.result
        ? transactionResult.result
        : transactionResult,
    );
  } catch (error) {
    if (error instanceof InteractionError) {
      return failure(error.code, error.message);
    }
    throw error;
  }
}

function publicStar(record) {
  if (
    !record ||
    record.status !== 'approved' ||
    !STAR_MOODS.has(record.mood) ||
    !STAR_COLORS.has(record.color)
  ) {
    return null;
  }
  const nickname = sanitizePlainText(record.nickname, 2, 16) || '匿名访客';
  const message = sanitizePlainText(record.message, 1, 30);
  const createdAt = normalizeDateForResponse(record.createdAt);
  return message && createdAt
    ? { nickname, message, mood: record.mood, color: record.color, createdAt }
    : null;
}

async function getPublicStars() {
  const result = await starCollection
    .where({ status: 'approved' })
    .orderBy('createdAt', 'desc')
    .limit(80)
    .get();
  const stars = (Array.isArray(result.data) ? result.data : [])
    .map(publicStar)
    .filter(Boolean);
  return success({ stars });
}

async function getMyStars(uid) {
  const result = await starCollection
    .where({ uid })
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();
  const stars = (Array.isArray(result.data) ? result.data : [])
    .map((record) => {
      const message = sanitizePlainText(record.message, 1, 30);
      const createdAt = normalizeDateForResponse(record.createdAt);
      if (
        !message ||
        !createdAt ||
        !STAR_MOODS.has(record.mood) ||
        !STAR_COLORS.has(record.color) ||
        !['pending', 'approved', 'rejected', 'hidden'].includes(record.status)
      ) {
        return null;
      }
      return {
        message,
        mood: record.mood,
        color: record.color,
        status: record.status,
        createdAt,
      };
    })
    .filter(Boolean);
  return success({ stars });
}

function randomPublicToken() {
  return crypto.randomBytes(24).toString('base64url');
}

async function createBottle(uid, date, event) {
  const content = sanitizePlainText(event.content, 1, 80);
  if (!content) return failure('INVALID_CONTENT', '漂流纸条需要是 1～80 个纯文本字符');
  if (!BOTTLE_CATEGORIES.has(event.category)) {
    return failure('INVALID_INPUT', '请选择有效的纸条分类');
  }
  const dailyId = hashDocumentId(uid, 'createBottle', date);
  const bottleId = hashDocumentId(uid, 'driftBottle', date);
  const publicToken = randomPublicToken();
  try {
    const transactionResult = await database.runTransaction(async (transaction) => {
      const dailyRef = transaction.collection('daily_interactions').doc(dailyId);
      const dailyResult = await dailyRef.get();
      const daily = firstDocument(dailyResult.data);
      if (
        daily &&
        daily.uid === uid &&
        daily.date === date &&
        daily.action === 'createBottle' &&
        Number(daily.count) >= 1
      ) {
        throw new InteractionError(
          'LIMIT_REACHED',
          '今天已经投递过一只漂流瓶，明天再来吧',
        );
      }
      const now = new Date();
      await transaction.collection('drift_bottles').doc(bottleId).set({
        data: {
          uid,
          content,
          category: event.category,
          publicToken,
          status: 'pending',
          responseCounts: {},
          deliveryCount: 0,
          lastDeliveredAt: null,
          nextAvailableAt: null,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
          reviewedAt: null,
          reviewedBy: null,
        },
      });
      await dailyRef.set({
        data: {
          uid,
          date,
          action: 'createBottle',
          count: 1,
          results: ['submitted'],
          createdAt: daily && daily.createdAt ? daily.createdAt : now,
          updatedAt: now,
        },
      });
      return { date, todayCount: 1, remainingCount: 0, limit: 1 };
    });
    return success(
      transactionResult && transactionResult.result
        ? transactionResult.result
        : transactionResult,
    );
  } catch (error) {
    if (error instanceof InteractionError) {
      return failure(error.code, error.message);
    }
    throw error;
  }
}

function safeBottle(record, includeStatus = false) {
  const content = sanitizePlainText(record && record.content, 1, 80);
  const createdAt = normalizeDateForResponse(record && record.createdAt);
  if (!content || !createdAt || !BOTTLE_CATEGORIES.has(record.category)) return null;
  const result = { content, category: record.category, createdAt };
  if (
    includeStatus &&
    ['pending', 'approved', 'rejected', 'hidden', 'archived'].includes(record.status)
  ) {
    return { ...result, status: record.status };
  }
  return result;
}

function normalizeBottleLifecycle(record, now) {
  const createdAt = parseDate(record && record.createdAt);
  if (!createdAt) return null;
  const deliveryCount =
    Number.isInteger(record.deliveryCount) && record.deliveryCount >= 0
      ? record.deliveryCount
      : 0;
  const lastDeliveredAt =
    parseDate(record.lastDeliveredAt) || createdAt;
  const nextAvailableAt =
    parseDate(record.nextAvailableAt) || new Date(0);
  return {
    deliveryCount,
    lastDeliveredAt,
    nextAvailableAt,
    expired: now.getTime() - createdAt.getTime() >= BOTTLE_MAX_AGE_MS,
  };
}

function bottleTieScore(uid, date, documentId) {
  return crypto
    .createHash('sha256')
    .update(`${uid}\n${date}\n${documentId}`, 'utf8')
    .digest()
    .readUInt32BE(0);
}

async function getBottleCandidates(uid, date, now) {
  const command = database.command;
  let readyRecords = [];
  try {
    const readyResult = await bottleCollection
      .where({
        status: 'approved',
        nextAvailableAt: command.lte(now),
      })
      .orderBy('nextAvailableAt', 'asc')
      .limit(BOTTLE_QUERY_LIMIT)
      .get();
    readyRecords = Array.isArray(readyResult.data) ? readyResult.data : [];
  } catch (error) {
    // 索引尚未创建时继续使用兼容旧文档的有界查询。
    safeLogError('bottle-ready-query', error);
  }
  const legacyResult = await bottleCollection
    .where({ status: 'approved' })
    .orderBy('createdAt', 'asc')
    .limit(BOTTLE_QUERY_LIMIT)
    .get();
  const merged = new Map();
  for (const record of [
    ...readyRecords,
    ...(Array.isArray(legacyResult.data) ? legacyResult.data : []),
  ]) {
    if (record && typeof record._id === 'string') merged.set(record._id, record);
  }
  return [...merged.values()]
    .filter((record) => {
      const lifecycle = normalizeBottleLifecycle(record, now);
      return (
        record.uid !== uid &&
        record.status === 'approved' &&
        typeof record.publicToken === 'string' &&
        record.publicToken.length >= 20 &&
        lifecycle &&
        lifecycle.deliveryCount < BOTTLE_MAX_DELIVERIES &&
        lifecycle.nextAvailableAt.getTime() <= now.getTime() &&
        safeBottle(record)
      );
    })
    .sort((left, right) => {
      const leftLifecycle = normalizeBottleLifecycle(left, now);
      const rightLifecycle = normalizeBottleLifecycle(right, now);
      if (!leftLifecycle || !rightLifecycle) return 0;
      return (
        leftLifecycle.deliveryCount - rightLifecycle.deliveryCount ||
        leftLifecycle.lastDeliveredAt.getTime() -
          rightLifecycle.lastDeliveredAt.getTime() ||
        bottleTieScore(uid, date, left._id) -
          bottleTieScore(uid, date, right._id)
      );
    })
    .slice(0, BOTTLE_QUERY_LIMIT);
}

function normalizeBottleRequests(daily, uid, date) {
  if (
    !daily ||
    daily.uid !== uid ||
    daily.date !== date ||
    daily.action !== 'drawBottle' ||
    !Array.isArray(daily.requests)
  ) {
    return [];
  }
  return daily.requests
    .filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.bottleId === 'string',
    )
    .slice(0, 3);
}

async function drawBottle(uid, date, requestId) {
  const now = new Date();
  const candidates = await getBottleCandidates(uid, date, now);
  const dailyId = hashDocumentId(uid, 'drawBottle', date);
  const recentStateId = hashDocumentId(uid, 'driftViewState');
  try {
    const transactionResult = await database.runTransaction(async (transaction) => {
      const dailyRef = transaction.collection('daily_interactions').doc(dailyId);
      const dailyResult = await dailyRef.get();
      const daily = firstDocument(dailyResult.data);
      const requests = normalizeBottleRequests(daily, uid, date);
      const drawnIds =
        daily &&
        daily.uid === uid &&
        daily.date === date &&
        daily.action === 'drawBottle' &&
        Array.isArray(daily.results)
          ? daily.results.filter((item) => typeof item === 'string').slice(0, 3)
          : [];
      const repeated = requests.find((item) => item.id === requestId);
      if (repeated) {
        const repeatedResult = await transaction
          .collection('drift_bottles')
          .doc(repeated.bottleId)
          .get();
        const repeatedBottle = firstDocument(repeatedResult.data);
        if (
          repeatedBottle &&
          ['approved', 'archived'].includes(repeatedBottle.status) &&
          repeatedBottle.uid !== uid &&
          safeBottle(repeatedBottle)
        ) {
          return {
            bottle: {
              ...safeBottle(repeatedBottle),
              bottleToken: repeatedBottle.publicToken,
            },
            date,
            todayCount: drawnIds.length,
            remainingCount: Math.max(0, 3 - drawnIds.length),
            limit: 3,
            idempotent: true,
          };
        }
        throw new InteractionError(
          'CONTENT_UNAVAILABLE',
          '这只漂流瓶已经离开公共水面，请再看看远处',
        );
      }
      if (drawnIds.length >= 3) {
        throw new InteractionError('LIMIT_REACHED', '今天已经捞过三只漂流瓶，明天再来看看');
      }
      const recentRef = transaction
        .collection('interaction_limits')
        .doc(recentStateId);
      const recentResult = await recentRef.get();
      const recentState = firstDocument(recentResult.data);
      const recentIds =
        recentState &&
        recentState.uid === uid &&
        Array.isArray(recentState.recentBottleIds)
          ? recentState.recentBottleIds
              .filter((item) => typeof item === 'string')
              .slice(0, BOTTLE_RECENT_LIMIT)
          : [];
      const preferred = candidates.filter(
        (record) =>
          !drawnIds.includes(record._id) && !recentIds.includes(record._id),
      );
      const fallback = candidates.filter(
        (record) =>
          !drawnIds.includes(record._id) && record._id !== recentIds[0],
      );
      const available = preferred.length > 0 ? preferred : fallback;
      let selected = null;
      let selectedRef = null;
      let selectedLifecycle = null;
      for (const candidate of available) {
        const candidateRef = transaction
          .collection('drift_bottles')
          .doc(candidate._id);
        const currentResult = await candidateRef.get();
        const current = firstDocument(currentResult.data);
        const lifecycle = normalizeBottleLifecycle(current, now);
        if (
          !current ||
          current.status !== 'approved' ||
          current.uid === uid ||
          !lifecycle ||
          lifecycle.nextAvailableAt.getTime() > now.getTime() ||
          lifecycle.deliveryCount >= BOTTLE_MAX_DELIVERIES ||
          !safeBottle(current)
        ) {
          continue;
        }
        if (lifecycle.expired) {
          await candidateRef.update({
            data: {
              status: 'archived',
              archivedAt: now,
              updatedAt: now,
            },
          });
          continue;
        }
        selected = current;
        selectedRef = candidateRef;
        selectedLifecycle = lifecycle;
        break;
      }
      if (!selected || !selectedRef || !selectedLifecycle) {
        throw new InteractionError(
          'NO_CONTENT',
          '水面上暂时没有新的漂流瓶，晚一点再来看看',
        );
      }
      const nextIds = [...drawnIds, selected._id];
      const nextRequests = [
        ...requests,
        { id: requestId, bottleId: selected._id },
      ];
      const nextDeliveryCount = selectedLifecycle.deliveryCount + 1;
      const shouldArchive = nextDeliveryCount >= BOTTLE_MAX_DELIVERIES;
      await selectedRef.update({
        data: {
          deliveryCount: nextDeliveryCount,
          lastDeliveredAt: now,
          nextAvailableAt: new Date(now.getTime() + BOTTLE_COOLDOWN_MS),
          status: shouldArchive ? 'archived' : 'approved',
          archivedAt: shouldArchive ? now : null,
          updatedAt: now,
        },
      });
      await dailyRef.set({
        data: {
          uid,
          date,
          action: 'drawBottle',
          count: nextIds.length,
          results: nextIds,
          requests: nextRequests,
          createdAt: daily && daily.createdAt ? daily.createdAt : now,
          updatedAt: now,
        },
      });
      await recentRef.set({
        data: {
          uid,
          recentBottleIds: [
            selected._id,
            ...recentIds.filter((item) => item !== selected._id),
          ].slice(0, BOTTLE_RECENT_LIMIT),
          createdAt:
            recentState && recentState.createdAt
              ? recentState.createdAt
              : now,
          updatedAt: now,
        },
      });
      return {
        bottle: {
          ...safeBottle(selected),
          bottleToken: selected.publicToken,
        },
        date,
        todayCount: nextIds.length,
        remainingCount: Math.max(0, 3 - nextIds.length),
        limit: 3,
      };
    });
    return success(
      transactionResult && transactionResult.result
        ? transactionResult.result
        : transactionResult,
    );
  } catch (error) {
    if (error instanceof InteractionError) {
      return failure(error.code, error.message);
    }
    throw error;
  }
}

async function respondBottle(uid, event) {
  if (
    event.bottleToken.length < 20 ||
    event.bottleToken.length > 80 ||
    !BOTTLE_RESPONSES.has(event.response)
  ) {
    return failure('INVALID_INPUT', '请选择有效的固定回应');
  }
  const bottleResult = await bottleCollection
    .where({ publicToken: event.bottleToken })
    .limit(1)
    .get();
  const bottle = firstDocument(bottleResult.data);
  if (
    !bottle ||
    bottle.uid === uid ||
    !['approved', 'archived'].includes(bottle.status)
  ) {
    return failure('NOT_FOUND', '这只漂流瓶暂时无法回应');
  }
  const responseId = hashDocumentId(uid, bottle._id, 'bottleResponse');
  try {
    await database.runTransaction(async (transaction) => {
      const responseRef = transaction
        .collection('drift_bottle_responses')
        .doc(responseId);
      const existingResult = await responseRef.get();
      if (firstDocument(existingResult.data)) {
        throw new InteractionError('ALREADY_RESPONDED', '已经回应过这只漂流瓶了');
      }
      const now = new Date();
      await responseRef.set({
        data: {
          uid,
          bottleId: bottle._id,
          response: event.response,
          createdAt: now,
        },
      });
    });
  } catch (error) {
    if (error instanceof InteractionError) {
      return failure(error.code, error.message);
    }
    throw error;
  }
  const counts = {};
  await Promise.all(
    [...BOTTLE_RESPONSES].map(async (response) => {
      const result = await bottleResponseCollection
        .where({ bottleId: bottle._id, response })
        .count();
      counts[response] = Number.isInteger(result.total) ? result.total : 0;
    }),
  );
  return success({ response: event.response, counts });
}

async function getMyBottles(uid) {
  const result = await bottleCollection
    .where({ uid })
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();
  const bottles = (Array.isArray(result.data) ? result.data : [])
    .map((record) => safeBottle(record, true))
    .filter(Boolean);
  return success({ bottles });
}

function capsuleQuotaId(uid) {
  return hashDocumentId(uid, 'timeCapsuleQuota');
}

function safeCapsuleSummary(record, now) {
  const title = sanitizePlainText(record && record.title, 1, 30);
  const createdAt = normalizeDateForResponse(record && record.createdAt);
  const unlockAtDate = parseDate(record && record.unlockAt);
  if (
    !title ||
    !createdAt ||
    !unlockAtDate ||
    typeof record.capsuleToken !== 'string' ||
    record.capsuleToken.length < 20 ||
    record.status !== 'active'
  ) {
    return null;
  }
  return {
    capsuleToken: record.capsuleToken,
    title,
    createdAt,
    unlockAt: unlockAtDate.toISOString(),
    unlocked: now.getTime() >= unlockAtDate.getTime(),
    remainingMs: Math.max(0, unlockAtDate.getTime() - now.getTime()),
  };
}

async function createCapsule(uid, event) {
  const title = sanitizePlainText(event.title, 1, 30);
  const content = sanitizePlainText(event.content, 1, 200);
  const unlockAt = parseDate(event.unlockAt);
  const now = new Date();
  const maxUnlockAt = now.getTime() + 5 * 365 * 24 * 60 * 60 * 1000;
  if (!title || !content) {
    return failure('INVALID_CONTENT', '胶囊标题需要 1～30 字，正文需要 1～200 字');
  }
  if (
    !unlockAt ||
    unlockAt.getTime() <= now.getTime() ||
    unlockAt.getTime() > maxUnlockAt
  ) {
    return failure('INVALID_TIME', '解锁时间需要晚于现在，并且不超过五年');
  }
  const capsuleId = crypto.randomBytes(12).toString('hex');
  const capsuleToken = randomPublicToken();
  const quotaId = capsuleQuotaId(uid);
  try {
    const transactionResult = await database.runTransaction(async (transaction) => {
      const quotaRef = transaction.collection('interaction_limits').doc(quotaId);
      const quotaResult = await quotaRef.get();
      const quota = firstDocument(quotaResult.data);
      const activeCount =
        quota && quota.uid === uid && Number.isInteger(quota.activeCapsules)
          ? Math.max(0, quota.activeCapsules)
          : 0;
      if (activeCount >= CAPSULE_LIMIT) {
        throw new InteractionError(
          'LIMIT_REACHED',
          '最多保留十枚未删除胶囊，可以先整理旧胶囊',
        );
      }
      const createdAt = new Date();
      await transaction.collection('time_capsules').doc(capsuleId).set({
        data: {
          uid,
          capsuleToken,
          title,
          content,
          unlockAt,
          status: 'active',
          createdAt,
          updatedAt: createdAt,
        },
      });
      await quotaRef.set({
        data: {
          uid,
          activeCapsules: activeCount + 1,
          updatedAt: createdAt,
          createdAt: quota && quota.createdAt ? quota.createdAt : createdAt,
        },
      });
      return {
        capsule: {
          capsuleToken,
          title,
          createdAt: createdAt.toISOString(),
          unlockAt: unlockAt.toISOString(),
          unlocked: false,
          remainingMs: unlockAt.getTime() - createdAt.getTime(),
        },
        activeCount: activeCount + 1,
        limit: CAPSULE_LIMIT,
      };
    });
    return success(
      transactionResult && transactionResult.result
        ? transactionResult.result
        : transactionResult,
    );
  } catch (error) {
    if (error instanceof InteractionError) {
      return failure(error.code, error.message);
    }
    throw error;
  }
}

async function getMyCapsules(uid) {
  const now = new Date();
  const result = await capsuleCollection
    .where({ uid, status: 'active' })
    .orderBy('createdAt', 'desc')
    .limit(CAPSULE_LIMIT)
    .get();
  const capsules = (Array.isArray(result.data) ? result.data : [])
    .map((record) => safeCapsuleSummary(record, now))
    .filter(Boolean);
  return success({ capsules, activeCount: capsules.length, limit: CAPSULE_LIMIT });
}

async function findOwnCapsule(uid, token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 80) return null;
  const result = await capsuleCollection
    .where({ uid, capsuleToken: token, status: 'active' })
    .limit(1)
    .get();
  return firstDocument(result.data);
}

async function openCapsule(uid, token) {
  const capsule = await findOwnCapsule(uid, token);
  if (!capsule) return failure('NOT_FOUND', '没有找到这枚胶囊');
  const unlockAt = parseDate(capsule.unlockAt);
  const now = new Date();
  if (!unlockAt || now.getTime() < unlockAt.getTime()) {
    return failure('LOCKED', '胶囊还没有到打开的时候', {
      data: {
        unlockAt: unlockAt ? unlockAt.toISOString() : null,
        remainingMs: unlockAt ? Math.max(0, unlockAt.getTime() - now.getTime()) : null,
      },
    });
  }
  const content = sanitizePlainText(capsule.content, 1, 200);
  const title = sanitizePlainText(capsule.title, 1, 30);
  if (!content || !title) return failure('INVALID_CONTENT', '胶囊内容暂时无法读取');
  return success({
    capsule: {
      capsuleToken: capsule.capsuleToken,
      title,
      content,
      unlockAt: unlockAt.toISOString(),
    },
  });
}

async function deleteCapsule(uid, token) {
  const capsule = await findOwnCapsule(uid, token);
  if (!capsule) return failure('NOT_FOUND', '没有找到这枚胶囊');
  const quotaId = capsuleQuotaId(uid);
  await database.runTransaction(async (transaction) => {
    const capsuleRef = transaction.collection('time_capsules').doc(capsule._id);
    const currentResult = await capsuleRef.get();
    const current = firstDocument(currentResult.data);
    if (
      !current ||
      current.uid !== uid ||
      current.capsuleToken !== token ||
      current.status !== 'active'
    ) {
      throw new InteractionError('NOT_FOUND', '没有找到这枚胶囊');
    }
    const quotaRef = transaction.collection('interaction_limits').doc(quotaId);
    const quotaResult = await quotaRef.get();
    const quota = firstDocument(quotaResult.data);
    const activeCount =
      quota && quota.uid === uid && Number.isInteger(quota.activeCapsules)
        ? Math.max(0, quota.activeCapsules)
        : 1;
    const now = new Date();
    await capsuleRef.update({
      data: { status: 'deleted', content: '', updatedAt: now, deletedAt: now },
    });
    await quotaRef.set({
      data: {
        uid,
        activeCapsules: Math.max(0, activeCount - 1),
        createdAt: quota && quota.createdAt ? quota.createdAt : now,
        updatedAt: now,
      },
    });
  });
  return success({ deleted: true });
}

async function getExistingReaction(uid, page, date) {
  const documentId = hashDocumentId(uid, page, date);
  const result = await reactionCollection
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
      reactionCollection.where({ page, date, reaction }).count(),
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
      `请稍等 ${retryAfterSeconds} 秒再修改今天的共鸣`,
      { retryAfterSeconds },
    );
  }

  let changed = false;
  if (current.reaction !== reaction) {
    const timestamp = database.serverDate();
    await reactionCollection.doc(current.documentId).set({
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
  return success({
    page,
    date,
    counts,
    currentReaction: reaction,
    changed,
  });
}

function normalizeDailyRecord(record, uid, action, date) {
  if (
    !record ||
    record.uid !== uid ||
    record.action !== action ||
    record.date !== date
  ) {
    return { cards: [], requests: [], count: 0 };
  }
  const cards = Array.isArray(record.results)
    ? record.results
        .filter((item) => Number.isInteger(item) && item >= 0)
        .slice(0, DAILY_DRAW_LIMIT)
    : [];
  const requests = Array.isArray(record.requests)
    ? record.requests
        .filter(
          (item) =>
            item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            item.id.length >= 20 &&
            Number.isInteger(item.index) &&
            item.index >= 0,
        )
        .slice(0, DAILY_DRAW_LIMIT)
    : [];
  return { cards, requests, count: cards.length };
}

function dailyState(action, date, cards, cardIndex = null) {
  const todayCount = Math.min(DAILY_DRAW_LIMIT, cards.length);
  return {
    action,
    date,
    card: Number.isInteger(cardIndex) ? { index: cardIndex } : null,
    cards: cards.map((index) => ({ index })),
    todayCount,
    remainingCount: Math.max(0, DAILY_DRAW_LIMIT - todayCount),
    limit: DAILY_DRAW_LIMIT,
    reachedLimit: todayCount >= DAILY_DRAW_LIMIT,
  };
}

function stablePoolIndex(uid, action, date, sequence, poolSize, used) {
  const digest = crypto
    .createHash('sha256')
    .update(`${uid}\n${action}\n${date}\n${sequence}`, 'utf8')
    .digest();
  const start = digest.readUInt32BE(0) % poolSize;
  for (let offset = 0; offset < poolSize; offset += 1) {
    const candidate = (start + offset) % poolSize;
    if (!used.has(candidate)) return candidate;
  }
  return start;
}

async function getDailyDrawState(uid, action, date) {
  const documentId = hashDocumentId(uid, action, date);
  const result = await dailyCollection.doc(documentId).get();
  const normalized = normalizeDailyRecord(
    firstDocument(result.data),
    uid,
    action,
    date,
  );
  return success(dailyState(action, date, normalized.cards));
}

async function drawDailyCard(uid, action, date, requestId) {
  const documentId = hashDocumentId(uid, action, date);
  try {
    const transactionResult = await database.runTransaction(
      async (transaction) => {
        const reference = transaction
          .collection('daily_interactions')
          .doc(documentId);
        const existingResult = await reference.get();
        const existing = firstDocument(existingResult.data);
        const normalized = normalizeDailyRecord(existing, uid, action, date);
        const repeated = normalized.requests.find(
          (request) => request.id === requestId,
        );
        if (repeated) {
          return {
            ...dailyState(action, date, normalized.cards, repeated.index),
            idempotent: true,
          };
        }
        if (normalized.count >= DAILY_DRAW_LIMIT) {
          throw new InteractionError(
            'LIMIT_REACHED',
            action === 'drawFortune'
              ? '今天的三张签已经收好，明天再来看看'
              : '今天留下的三段记忆已经够了',
            dailyState(action, date, normalized.cards),
          );
        }
        const nextIndex = stablePoolIndex(
          uid,
          action,
          date,
          normalized.count,
          DAILY_POOL_SIZES[action],
          new Set(normalized.cards),
        );
        const nextCards = [...normalized.cards, nextIndex];
        const nextRequests = [
          ...normalized.requests,
          { id: requestId, index: nextIndex },
        ];
        const now = new Date();
        await reference.set({
          data: {
            uid,
            date,
            action,
            count: nextCards.length,
            results: nextCards,
            requests: nextRequests,
            createdAt:
              existing && existing.createdAt ? existing.createdAt : now,
            updatedAt: now,
          },
        });
        return dailyState(action, date, nextCards, nextIndex);
      },
    );
    return success(
      transactionResult && transactionResult.result
        ? transactionResult.result
        : transactionResult,
    );
  } catch (error) {
    if (error instanceof InteractionError) {
      return failure(error.code, error.message, { data: error.data });
    }
    throw error;
  }
}

exports.main = async (event, context) => {
  const validationFailure = validateInput(event);
  if (validationFailure) return validationFailure;

  const uid = getAuthenticatedUid(context);
  if (event.action !== 'getPublicStars' && !uid) {
    return failure('NOT_LOGGED_IN', '请先以游客身份进入，再使用这里的互动');
  }

  const date = chinaDateKey();
  try {
    if (event.action === 'getPublicStars') {
      return await getPublicStars();
    }
    if (event.action === 'createStar') {
      return await createStar(uid, date, event);
    }
    if (event.action === 'getMyStars') {
      return await getMyStars(uid);
    }
    if (event.action === 'createBottle') {
      return await createBottle(uid, date, event);
    }
    if (event.action === 'drawBottle') {
      return await drawBottle(uid, date, event.requestId);
    }
    if (event.action === 'respondBottle') {
      return await respondBottle(uid, event);
    }
    if (event.action === 'getMyBottles') {
      return await getMyBottles(uid);
    }
    if (event.action === 'createCapsule') {
      return await createCapsule(uid, event);
    }
    if (event.action === 'getMyCapsules') {
      return await getMyCapsules(uid);
    }
    if (event.action === 'openCapsule') {
      return await openCapsule(uid, event.capsuleToken);
    }
    if (event.action === 'deleteCapsule') {
      return await deleteCapsule(uid, event.capsuleToken);
    }
    if (event.action === 'getReactions') {
      return await getReactions(uid, event.page, date);
    }
    if (event.action === 'react') {
      return await react(uid, event.page, date, event.reaction);
    }
    if (event.mode === 'get') {
      return await getDailyDrawState(uid, event.action, date);
    }
    return await drawDailyCard(uid, event.action, date, event.requestId);
  } catch (error) {
    safeLogError(event.action, error);
    return failure(
      'INTERACTION_UNAVAILABLE',
      '互动暂时没有连接上，请稍后再试',
    );
  }
};
