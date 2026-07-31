export type AnswerCategory =
  | '温柔肯定'
  | '谨慎等待'
  | '主动行动'
  | '换个方向'
  | '暂时放下'
  | '相信直觉'
  | '寻求帮助'
  | '再观察一下';

export interface AnswerBookEntry {
  answer: string;
  hint: string;
  category: AnswerCategory;
}

const answerBeginnings: Array<{ text: string; category: AnswerCategory }> = [
  { text: '可以试着往前走一点', category: '主动行动' },
  { text: '答案更接近肯定', category: '温柔肯定' },
  { text: '先别急着得出结论', category: '谨慎等待' },
  { text: '换一个角度再看', category: '换个方向' },
  { text: '这件事可以暂时放一放', category: '暂时放下' },
  { text: '你已经知道自己更在意什么', category: '相信直觉' },
  { text: '找一个信任的人聊聊', category: '寻求帮助' },
  { text: '还需要再观察一小段时间', category: '再观察一下' },
  { text: '先完成最小的一步', category: '主动行动' },
  { text: '目前的方向值得继续尝试', category: '温柔肯定' },
  { text: '让信息再多一点', category: '谨慎等待' },
  { text: '也许问题本身可以重新描述', category: '换个方向' },
  { text: '今天不处理也没有关系', category: '暂时放下' },
  { text: '第一反应里可能藏着线索', category: '相信直觉' },
  { text: '不必一个人把它想完', category: '寻求帮助' },
  { text: '先看看事情接下来怎么变化', category: '再观察一下' },
  { text: '动手以后会更清楚', category: '主动行动' },
  { text: '可以给这个想法一点信任', category: '温柔肯定' },
  { text: '再睡一晚也许更合适', category: '谨慎等待' },
  { text: '绕一点路可能会看见出口', category: '换个方向' },
] as const;

const answerEndings = [
  '，但先把风险和边界看清楚',
  '，从不会后悔的小动作开始',
  '，不用一次决定很远的以后',
  '，给自己留一个可以调整的位置',
  '，如果不舒服就停下来重新想',
  '，把它当成一次轻量的尝试',
] as const;

const answerHints = [
  '答案只是一张纸条，重要决定仍要回到真实信息',
  '先写下你已经确认的部分',
  '不用因为这句话立刻行动',
  '高风险问题请咨询可靠的专业人士',
  '这不是预测，只是换一个思考角度',
  '如果仍然犹豫，可以先休息十分钟',
] as const;

export const answerBookEntries: AnswerBookEntry[] = answerBeginnings.flatMap(
  (beginning, beginningIndex) =>
    answerEndings.map((ending, endingIndex) => ({
      answer: `${beginning.text}${ending}`,
      hint:
        answerHints[(beginningIndex + endingIndex) % answerHints.length],
      category: beginning.category,
    })),
);
