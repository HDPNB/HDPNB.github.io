import {
  expandedDailyFortuneCopies,
  expandedHomeWelcomeCopies,
  memoryCardDeck,
  memoryObjectCopies,
  sakuraCompleteCopies,
} from '@/data/copywriting';

export const welcomeMessages = expandedHomeWelcomeCopies;

export const dailyMoods = [
  '慢一点也没关系',
  '适合抬头看看云',
  '先把眼前的小事做好',
  '允许今天只是普通的一天',
  '有一点困，也有一点期待',
  '风会把没想明白的事吹远一点',
] as const;

export const articleReactions = [
  { id: 'warm', emoji: '🌿', label: '很温柔' },
  { id: 'like', emoji: '🙂', label: '喜欢' },
  { id: 'inspired', emoji: '💡', label: '有启发' },
  { id: 'together', emoji: '☕', label: '陪你坐会儿' },
] as const;

export const sakuraCollectMessages = sakuraCompleteCopies;

export const memorySceneQuotes = [
  ...memoryObjectCopies.capsule,
  ...memoryObjectCopies.orb,
  ...memoryObjectCopies.paper,
] as const;

export const memoryCardMessages = memoryCardDeck;

export const resonanceOptions = [
  { id: 'healing', emoji: '🌿', label: '治愈' },
  { id: 'curious', emoji: '◌', label: '好奇' },
  { id: 'cheer', emoji: '✦', label: '加油' },
  { id: 'miss', emoji: '☁', label: '想念' },
] as const;

const fortuneTypes = ['学习', '尝试', '项目', '生活', '休息', '勇气'] as const;
export const dailyFortunes = expandedDailyFortuneCopies.map((text, index) => ({
  type: fortuneTypes[index % fortuneTypes.length],
  text,
}));
