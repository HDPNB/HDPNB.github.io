export type SiteReactionId = 'healing' | 'curious' | 'cheer' | 'miss';

export type SiteReactionPage =
  | 'home'
  | 'life'
  | 'learn'
  | 'projects'
  | 'about'
  | 'guestbook'
  | 'gallery';

export type SiteReactionCounts = Record<SiteReactionId, number>;

export interface SiteReactionState {
  page: SiteReactionPage;
  date: string;
  counts: SiteReactionCounts;
  currentReaction: SiteReactionId | null;
  changed?: boolean;
}

export type SiteInteractionResult =
  | { ok: true; data: SiteReactionState }
  | {
      ok: false;
      code: 'disabled' | 'signed-out' | 'rate-limited' | 'unavailable';
      message: string;
    };

export interface DailyDrawCard {
  index: number;
}

export interface DailyDrawState {
  action: 'drawFortune' | 'drawMemoryCard';
  date: string;
  card: DailyDrawCard | null;
  cards: DailyDrawCard[];
  used: number;
  remaining: number;
  todayCount: number;
  remainingCount: number;
  limit: number;
  reachedLimit: boolean;
}

export interface DailyDrawOverview {
  date: string;
  fortune: DailyDrawState;
  memoryCard: DailyDrawState;
}

export type DailyDrawOverviewResult =
  | { ok: true; data: DailyDrawOverview }
  | {
      ok: false;
      code: 'disabled' | 'signed-out' | 'rate-limited' | 'unavailable';
      message: string;
    };

export type DailyDrawResult =
  | { ok: true; data: DailyDrawState }
  | {
      ok: false;
      code:
        | 'disabled'
        | 'signed-out'
        | 'limit-reached'
        | 'rate-limited'
        | 'unavailable';
      message: string;
      data?: DailyDrawState;
    };

export type StarMood = 'healing' | 'miss' | 'happy' | 'calm' | 'hope' | 'cheer';
export type StarColor = 'sage' | 'gold' | 'blue' | 'rose' | 'cream';
export type ReviewStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'hidden'
  | 'archived';

export interface PublicStar {
  nickname: string;
  message: string;
  mood: StarMood;
  color: StarColor;
  createdAt: string;
}

export interface OwnStar {
  message: string;
  mood: StarMood;
  color: StarColor;
  status: ReviewStatus;
  createdAt: string;
}

export interface DailySubmissionState {
  date: string;
  todayCount: number;
  remainingCount: number;
  limit: number;
}

export interface MyStarsState extends DailySubmissionState {
  stars: OwnStar[];
}

export type InteractionApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code:
        | 'disabled'
        | 'signed-out'
        | 'limit-reached'
        | 'rate-limited'
        | 'invalid'
        | 'unavailable';
      message: string;
    };

export type BottleCategory =
  | 'mood'
  | 'unsaid'
  | 'blessing'
  | 'worry'
  | 'good-news';
export type BottleResponse =
  | 'hug'
  | 'received'
  | 'cheer'
  | 'happy-for-you'
  | 'wish';

export interface DrawnBottle {
  bottleToken: string;
  content: string;
  category: BottleCategory;
  createdAt: string;
}

export interface OwnBottle {
  content: string;
  category: BottleCategory;
  status: ReviewStatus;
  createdAt: string;
}

export interface MyBottlesState extends DailySubmissionState {
  bottles: OwnBottle[];
}

export interface CapsuleSummary {
  capsuleToken: string;
  title: string;
  createdAt: string;
  unlockAt: string;
  unlocked: boolean;
  remainingMs: number;
}

export interface OpenedCapsule {
  capsuleToken: string;
  title: string;
  content: string;
  unlockAt: string;
}
