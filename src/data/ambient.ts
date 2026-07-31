export type AmbientVariant =
  | 'sakura'
  | 'life'
  | 'learn'
  | 'projects'
  | 'about'
  | 'guestbook'
  | 'gallery'
  | 'scan'
  | 'stardust';

export interface AmbientEffectConfig {
  variant: AmbientVariant;
  counts: {
    high: number;
    normal: number;
    low: number;
    mobile: number;
  };
  speed: number;
  maxFps: number;
  opacity: number;
  labels: readonly string[];
  lightColors: readonly string[];
  darkColors: readonly string[];
}

export const ambientEffects: Record<AmbientVariant, AmbientEffectConfig> = {
  sakura: {
    variant: 'sakura',
    counts: { high: 48, normal: 40, low: 28, mobile: 20 },
    speed: 1,
    maxFps: 40,
    opacity: 0.78,
    labels: [],
    lightColors: ['#c99d9b', '#ddb7ae', '#b98f91'],
    darkColors: ['#d4aaa5', '#b99191', '#e0b9ad'],
  },
  life: {
    variant: 'life',
    counts: { high: 38, normal: 30, low: 18, mobile: 15 },
    speed: 0.58,
    maxFps: 32,
    opacity: 0.48,
    labels: [],
    lightColors: ['#b59b64', '#c2aa70', '#90a28d'],
    darkColors: ['#d1ad70', '#c79654', '#a6b698'],
  },
  learn: {
    variant: 'learn',
    counts: { high: 22, normal: 17, low: 10, mobile: 8 },
    speed: 0.38,
    maxFps: 30,
    opacity: 0.28,
    labels: ['{}', '[]', '</ >', '01', 'C++', 'Python', 'ESP32', 'GPIO', 'UART', 'while', 'return', 'nullptr'],
    lightColors: ['#688176', '#7f9197', '#9b8d7d'],
    darkColors: ['#a9bdae', '#9fb4bd', '#c4b29f'],
  },
  projects: {
    variant: 'projects',
    counts: { high: 24, normal: 18, low: 11, mobile: 8 },
    speed: 0.46,
    maxFps: 34,
    opacity: 0.42,
    labels: [],
    lightColors: ['#789588', '#829ca4', '#aa9479'],
    darkColors: ['#a4bba9', '#94b0bb', '#c0aa8c'],
  },
  about: {
    variant: 'about',
    counts: { high: 28, normal: 22, low: 13, mobile: 10 },
    speed: 0.3,
    maxFps: 30,
    opacity: 0.38,
    labels: ['记', '慢', '光', '…'],
    lightColors: ['#8b9d94', '#a79689', '#8ca0aa'],
    darkColors: ['#b6c4bc', '#c4b5a7', '#a9bec7'],
  },
  guestbook: {
    variant: 'guestbook',
    counts: { high: 16, normal: 12, low: 7, mobile: 6 },
    speed: 0.42,
    maxFps: 28,
    opacity: 0.34,
    labels: [],
    lightColors: ['#879d91', '#9cabb0', '#b19a82'],
    darkColors: ['#adc0b3', '#a8bbc2', '#ccb69c'],
  },
  gallery: {
    variant: 'gallery',
    counts: { high: 25, normal: 18, low: 10, mobile: 8 },
    speed: 0.24,
    maxFps: 30,
    opacity: 0.34,
    labels: [],
    lightColors: ['#d4c6aa', '#a7bbb4', '#b3c2c8'],
    darkColors: ['#d2c3a8', '#a8c0b4', '#a6bcc4'],
  },
  scan: {
    variant: 'scan',
    counts: { high: 1, normal: 1, low: 1, mobile: 1 },
    speed: 0.2,
    maxFps: 24,
    opacity: 0.2,
    labels: [],
    lightColors: ['#829b8d'],
    darkColors: ['#a5bbae'],
  },
  stardust: {
    variant: 'stardust',
    counts: { high: 20, normal: 15, low: 9, mobile: 7 },
    speed: 0.25,
    maxFps: 28,
    opacity: 0.3,
    labels: [],
    lightColors: ['#95a69e', '#a8a092', '#93a8b0'],
    darkColors: ['#b4c2bb', '#c4b9a7', '#a9bbc2'],
  },
};

export function resolveAmbientVariant(pathname: string): AmbientVariant {
  if (pathname === '/') return 'sakura';
  if (pathname.startsWith('/life/')) return 'life';
  if (pathname.startsWith('/learn/')) return 'learn';
  if (pathname.startsWith('/projects/')) return 'projects';
  if (pathname.startsWith('/about/')) return 'about';
  if (pathname.startsWith('/guestbook/')) return 'guestbook';
  if (pathname.startsWith('/gallery/')) return 'gallery';
  if (pathname.startsWith('/admin-check/')) return 'scan';
  return 'stardust';
}
