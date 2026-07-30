import { getCloudBaseClient } from '@/lib/cloudbase';
import type {
  SiteInteractionResult,
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
