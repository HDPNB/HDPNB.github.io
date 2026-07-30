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
