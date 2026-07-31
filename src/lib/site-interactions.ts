import { getCloudBaseClient } from '@/lib/cloudbase';
import type {
  SiteInteractionResult,
  DailyDrawResult,
  DailyDrawState,
  InteractionApiResult,
  OwnStar,
  PublicStar,
  StarColor,
  StarMood,
  BottleCategory,
  BottleResponse,
  CapsuleSummary,
  DrawnBottle,
  OpenedCapsule,
  OwnBottle,
  SiteReactionCounts,
  SiteReactionId,
  SiteReactionPage,
  SiteReactionState,
} from '@/types/site-interactions';

const REACTIONS: SiteReactionId[] = [
  'healing',
  'curious',
  'cheer',
  'miss',
];

function isReaction(value: unknown): value is SiteReactionId {
  return typeof value === 'string' && REACTIONS.includes(value as SiteReactionId);
}

function parseCounts(value: unknown): SiteReactionCounts | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const entries = REACTIONS.map((reaction) => {
    const count = source[reaction];
    return [
      reaction,
      typeof count === 'number' && Number.isInteger(count) && count >= 0
        ? count
        : null,
    ] as const;
  });
  if (entries.some(([, count]) => count === null)) return null;
  return Object.fromEntries(entries) as SiteReactionCounts;
}

function parseState(
  value: unknown,
  expectedPage: SiteReactionPage,
): SiteReactionState | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const counts = parseCounts(source.counts);
  const currentReaction =
    source.currentReaction === null
      ? null
      : isReaction(source.currentReaction)
        ? source.currentReaction
        : undefined;
  if (
    source.page !== expectedPage ||
    typeof source.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(source.date) ||
    !counts ||
    currentReaction === undefined
  ) {
    return null;
  }
  return {
    page: expectedPage,
    date: source.date,
    counts,
    currentReaction,
    changed: source.changed === true,
  };
}

async function callInteraction(
  page: SiteReactionPage,
  action: 'getReactions' | 'react',
  reaction?: SiteReactionId,
): Promise<SiteInteractionResult> {
  const cloudbase = await getCloudBaseClient();
  if (!cloudbase.ok) {
    return {
      ok: false,
      code: 'disabled',
      message: '互动功能暂时没有开启。',
    };
  }

  try {
    const response = await cloudbase.client.app.callFunction({
      name: 'site-interactions',
      data:
        action === 'react'
          ? { action, page, reaction }
          : { action, page },
      parse: true,
    });
    const result = response.result;
    if (!result || typeof result !== 'object') {
      return {
        ok: false,
        code: 'unavailable',
        message: '互动暂时没有连接上。',
      };
    }

    const payload = result as Record<string, unknown>;
    if (payload.ok !== true) {
      const code =
        payload.code === 'NOT_LOGGED_IN'
          ? 'signed-out'
          : payload.code === 'RATE_LIMITED'
            ? 'rate-limited'
            : 'unavailable';
      return {
        ok: false,
        code,
        message:
          typeof payload.message === 'string' && payload.message.length <= 80
            ? payload.message
            : '互动暂时没有连接上。',
      };
    }

    const state = parseState(
      payload.data,
      page,
    );
    return state
      ? { ok: true, data: state }
      : {
          ok: false,
          code: 'unavailable',
          message: '互动暂时没有连接上。',
        };
  } catch {
    return {
      ok: false,
      code: 'unavailable',
      message: '互动暂时没有连接上。',
    };
  }
}

export function getSiteReactions(
  page: SiteReactionPage,
): Promise<SiteInteractionResult> {
  return callInteraction(page, 'getReactions');
}

export function leaveSiteReaction(
  page: SiteReactionPage,
  reaction: SiteReactionId,
): Promise<SiteInteractionResult> {
  return callInteraction(page, 'react', reaction);
}

function parseDailyDrawState(
  value: unknown,
  action: DailyDrawState['action'],
): DailyDrawState | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const cards = Array.isArray(source.cards)
    ? source.cards
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const index = (item as Record<string, unknown>).index;
          return typeof index === 'number' && Number.isInteger(index) && index >= 0
            ? { index }
            : null;
        })
        .filter((item): item is { index: number } => Boolean(item))
    : [];
  const cardSource =
    source.card && typeof source.card === 'object'
      ? (source.card as Record<string, unknown>)
      : null;
  const card =
    cardSource &&
    typeof cardSource.index === 'number' &&
    Number.isInteger(cardSource.index) &&
    cardSource.index >= 0
      ? { index: cardSource.index }
      : null;
  if (
    source.action !== action ||
    typeof source.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(source.date) ||
    typeof source.todayCount !== 'number' ||
    !Number.isInteger(source.todayCount) ||
    typeof source.remainingCount !== 'number' ||
    !Number.isInteger(source.remainingCount) ||
    source.limit !== 3
  ) {
    return null;
  }
  return {
    action,
    date: source.date,
    card,
    cards,
    todayCount: Math.max(0, source.todayCount),
    remainingCount: Math.max(0, source.remainingCount),
    limit: 3,
    reachedLimit: source.reachedLimit === true,
  };
}

async function callDailyDraw(
  action: DailyDrawState['action'],
  mode: 'get' | 'draw',
): Promise<DailyDrawResult> {
  const cloudbase = await getCloudBaseClient();
  if (!cloudbase.ok) {
    return {
      ok: false,
      code: 'disabled',
      message: '互动功能暂时没有开启',
    };
  }
  try {
    const requestId =
      mode === 'draw'
        ? typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
              byte.toString(16).padStart(2, '0'),
            ).join('')
        : undefined;
    const response = await cloudbase.client.app.callFunction({
      name: 'site-interactions',
      data: { action, mode, ...(requestId ? { requestId } : {}) },
      parse: true,
    });
    const payload =
      response.result && typeof response.result === 'object'
        ? (response.result as Record<string, unknown>)
        : null;
    if (!payload) {
      return { ok: false, code: 'unavailable', message: '今天的卡片暂时没有连接上' };
    }
    const state = parseDailyDrawState(payload.data, action);
    if (payload.ok === true && state) return { ok: true, data: state };
    const code =
      payload.code === 'NOT_LOGGED_IN'
        ? 'signed-out'
        : payload.code === 'LIMIT_REACHED'
          ? 'limit-reached'
          : payload.code === 'RATE_LIMITED'
            ? 'rate-limited'
            : 'unavailable';
    return {
      ok: false,
      code,
      message:
        typeof payload.message === 'string' && payload.message.length <= 100
          ? payload.message
          : '今天的卡片暂时没有连接上',
      ...(state ? { data: state } : {}),
    };
  } catch {
    return {
      ok: false,
      code: 'unavailable',
      message: '网络有点慢，卡片还没有送到',
    };
  }
}

export function getDailyFortuneState(): Promise<DailyDrawResult> {
  return callDailyDraw('drawFortune', 'get');
}

export function drawDailyFortune(): Promise<DailyDrawResult> {
  return callDailyDraw('drawFortune', 'draw');
}

export function getDailyMemoryState(): Promise<DailyDrawResult> {
  return callDailyDraw('drawMemoryCard', 'get');
}

export function drawDailyMemoryCard(): Promise<DailyDrawResult> {
  return callDailyDraw('drawMemoryCard', 'draw');
}

async function callFeature<T>(
  action: string,
  data: Record<string, unknown> = {},
): Promise<InteractionApiResult<T>> {
  const cloudbase = await getCloudBaseClient();
  if (!cloudbase.ok) {
    return { ok: false, code: 'disabled', message: '互动功能暂时没有开启' };
  }
  try {
    const response = await cloudbase.client.app.callFunction({
      name: 'site-interactions',
      data: { action, ...data },
      parse: true,
    });
    const payload =
      response.result && typeof response.result === 'object'
        ? (response.result as Record<string, unknown>)
        : null;
    if (payload?.ok === true && payload.data && typeof payload.data === 'object') {
      return { ok: true, data: payload.data as T };
    }
    const code =
      payload?.code === 'NOT_LOGGED_IN'
        ? 'signed-out'
        : payload?.code === 'LIMIT_REACHED'
          ? 'limit-reached'
          : payload?.code === 'RATE_LIMITED'
            ? 'rate-limited'
            : typeof payload?.code === 'string' && payload.code.startsWith('INVALID')
              ? 'invalid'
              : 'unavailable';
    return {
      ok: false,
      code,
      message:
        typeof payload?.message === 'string' && payload.message.length <= 120
          ? payload.message
          : '互动暂时没有连接上',
    };
  } catch {
    return { ok: false, code: 'unavailable', message: '网络有点慢，请稍后再试' };
  }
}

export function createVisitorStar(input: {
  message: string;
  mood: StarMood;
  color: StarColor;
}): Promise<InteractionApiResult<{ date: string; todayCount: number; remainingCount: number; limit: number }>> {
  return callFeature('createStar', input);
}

export function getPublicVisitorStars(): Promise<
  InteractionApiResult<{ stars: PublicStar[] }>
> {
  return callFeature('getPublicStars');
}

export function getMyVisitorStars(): Promise<
  InteractionApiResult<{ stars: OwnStar[] }>
> {
  return callFeature('getMyStars');
}

export function createDriftBottle(input: {
  content: string;
  category: BottleCategory;
}): Promise<InteractionApiResult<{ date: string; todayCount: number; remainingCount: number; limit: number }>> {
  return callFeature('createBottle', input);
}

export function drawDriftBottle(): Promise<
  InteractionApiResult<{
    bottle: DrawnBottle;
    date: string;
    todayCount: number;
    remainingCount: number;
    limit: number;
  }>
> {
  const requestId =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('');
  return callFeature('drawBottle', { requestId });
}

export function respondToDriftBottle(
  bottleToken: string,
  response: BottleResponse,
): Promise<InteractionApiResult<{ response: BottleResponse; counts: Record<string, number> }>> {
  return callFeature('respondBottle', { bottleToken, response });
}

export function getMyDriftBottles(): Promise<
  InteractionApiResult<{ bottles: OwnBottle[] }>
> {
  return callFeature('getMyBottles');
}

export function createTimeCapsule(input: {
  title: string;
  content: string;
  unlockAt: string;
}): Promise<
  InteractionApiResult<{
    capsule: CapsuleSummary;
    activeCount: number;
    limit: number;
  }>
> {
  return callFeature('createCapsule', input);
}

export function getMyTimeCapsules(): Promise<
  InteractionApiResult<{
    capsules: CapsuleSummary[];
    activeCount: number;
    limit: number;
  }>
> {
  return callFeature('getMyCapsules');
}

export function openTimeCapsule(
  capsuleToken: string,
): Promise<InteractionApiResult<{ capsule: OpenedCapsule }>> {
  return callFeature('openCapsule', { capsuleToken });
}

export function deleteTimeCapsule(
  capsuleToken: string,
): Promise<InteractionApiResult<{ deleted: boolean }>> {
  return callFeature('deleteCapsule', { capsuleToken });
}
