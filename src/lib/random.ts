export type RandomSource = () => number;

export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed: string | number): RandomSource {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickRandom<T>(
  values: readonly T[],
  random: RandomSource = Math.random,
  excludedIndex = -1,
): { value: T | undefined; index: number } {
  if (values.length === 0) return { value: undefined, index: -1 };
  if (values.length === 1) return { value: values[0], index: 0 };
  let index = Math.floor(random() * values.length);
  if (index === excludedIndex) index = (index + 1) % values.length;
  return { value: values[index], index };
}

export function localDateKey(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function dailyRandom(namespace: string, date = new Date()): RandomSource {
  return seededRandom(`${namespace}:${localDateKey(date)}`);
}

export function entryRandom(namespace: string): RandomSource {
  const entropy =
    typeof performance === 'undefined'
      ? Date.now()
      : Math.round(performance.timeOrigin + performance.now());
  return seededRandom(`${namespace}:${entropy}`);
}

export function browserSeed(storageKey = 'hdp-random-seed'): string {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) return saved;
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    const created = `${values[0].toString(36)}${values[1].toString(36)}`;
    localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return `${Date.now().toString(36)}-local`;
  }
}
