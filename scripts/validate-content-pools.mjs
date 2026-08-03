import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const projectFile = (path) => new URL(`../${path}`, import.meta.url);

async function importTypeScriptModule(path) {
  const source = await readFile(projectFile(path), 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`;
  return import(dataUrl);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(values) {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex');
}

const copywriting = await importTypeScriptModule('src/data/copywriting.ts');
const answerBook = await importTypeScriptModule('src/data/answer-book.ts');
const cloudFunction = await readFile(
  projectFile('cloudfunctions/site-interactions/index.js'),
  'utf8',
);

const fortunePoolMatch = cloudFunction.match(/drawFortune:\s*(\d+)/);
const memoryPoolMatch = cloudFunction.match(/drawMemoryCard:\s*(\d+)/);
assert(fortunePoolMatch && memoryPoolMatch, '无法读取云函数中的每日内容池大小');

const cloudFortunePoolSize = Number(fortunePoolMatch[1]);
const cloudMemoryPoolSize = Number(memoryPoolMatch[1]);
const fortuneCopies = copywriting.expandedDailyFortuneCopies;
const memoryCopies = copywriting.expandedMemoryCardCopies;
const memoryDeck = copywriting.memoryCardDeck;

assert(copywriting.DAILY_FORTUNE_POOL_SIZE === 300, '每日签文目标数量必须为 300');
assert(copywriting.MEMORY_CARD_POOL_SIZE === 240, '每日回忆卡目标数量必须为 240');
assert(fortuneCopies.length === cloudFortunePoolSize, '签文前端数据与云函数索引池不一致');
assert(memoryDeck.length === cloudMemoryPoolSize, '回忆卡前端数据与云函数索引池不一致');
assert(memoryCopies.length === memoryDeck.length, '回忆卡文案与卡片数据数量不一致');
assert(new Set(fortuneCopies).size === fortuneCopies.length, '每日签文中存在重复内容');
assert(answerBook.answerBookEntries.length === 360, '答案之书目标数量必须为 360');
assert(
  new Set(answerBook.answerBookEntries.map((entry) => entry.answer)).size === 360,
  '答案之书中存在重复答案',
);

assert(
  hash(fortuneCopies.slice(0, 120)) ===
    '983e0a0290e458f18b40645ebbe713ca2d347e2408b35fc0cc865bac02a1b5ab',
  '原有 120 条签文的顺序或内容发生变化',
);
assert(
  hash(answerBook.answerBookEntries.slice(0, 180)) ===
    'a1aff4aaa2c46fdeaf2ace7ea98dc740f524f0cabbd9be05486cdba70b494441',
  '原有 180 条答案的顺序或内容发生变化',
);

for (let index = 56; index < 60; index += 1) {
  assert(
    memoryCopies[index] === memoryCopies[index - 56],
    `旧回忆卡索引 ${index} 的兼容映射发生变化`,
  );
}

console.log(
  `内容池校验通过：签文 ${fortuneCopies.length} 条，回忆卡 ${memoryDeck.length} 条，答案 ${answerBook.answerBookEntries.length} 条。`,
);
