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
  { text: '现在还不是最合适的时候', category: '谨慎等待' },
  { text: '可以先迈出很小的一步', category: '主动行动' },
  { text: '你已经比想象中更接近了', category: '温柔肯定' },
  { text: '先照顾好自己的感受', category: '暂时放下' },
  { text: '保留一点耐心会更从容', category: '谨慎等待' },
  { text: '答案可能藏在行动里', category: '主动行动' },
  { text: '不必急着马上决定', category: '谨慎等待' },
  { text: '把熟悉的方向稍微转一转', category: '换个方向' },
  { text: '让直觉和事实都说完', category: '再观察一下' },
  { text: '需要的帮助可以说出来', category: '寻求帮助' },
  { text: '这次可以温柔地说不', category: '暂时放下' },
  { text: '先把真正想问的那句话说清楚', category: '寻求帮助' },
  { text: '答案也许在一次坦诚的沟通里', category: '寻求帮助' },
  { text: '不妨先听听身体和情绪的声音', category: '相信直觉' },
  { text: '给变化留一点自然发生的时间', category: '谨慎等待' },
  { text: '眼前的阻力未必是在拒绝你', category: '换个方向' },
  { text: '先做一件五分钟能完成的小事', category: '主动行动' },
  { text: '允许自己暂时没有标准答案', category: '暂时放下' },
  { text: '这件事值得再确认一次边界', category: '再观察一下' },
  { text: '可以把期待调轻一点再出发', category: '换个方向' },
  { text: '先问问对方真正需要什么', category: '寻求帮助' },
  { text: '现在的迟疑也有它的理由', category: '谨慎等待' },
  { text: '今天适合收集线索而不是定论', category: '再观察一下' },
  { text: '试着选择让呼吸更轻松的那个方向', category: '相信直觉' },
  { text: '一个小小的回应就足够开始', category: '主动行动' },
  { text: '这次不必把所有人的期待都带上', category: '暂时放下' },
  { text: '事情可能没有想象中那么严肃', category: '换个方向' },
  { text: '先把能验证的部分验证一下', category: '主动行动' },
  { text: '等心里的噪声小一点再听答案', category: '谨慎等待' },
  { text: '有人一起想会比独自猜更清楚', category: '寻求帮助' },
  { text: '你可以保留修改主意的权利', category: '温柔肯定' },
  { text: '这条路不需要一次走到尽头', category: '主动行动' },
  { text: '先看看重复出现的感受在提醒什么', category: '再观察一下' },
  { text: '也许只是需要换一个更舒服的节奏', category: '换个方向' },
  { text: '暂时离开问题也可能带来线索', category: '暂时放下' },
  { text: '你在意的部分值得被认真表达', category: '温柔肯定' },
  { text: '再多问一个为什么会更接近核心', category: '再观察一下' },
  { text: '可以相信那份安静而持续的喜欢', category: '相信直觉' },
  { text: '先确认这是不是你真正想承担的', category: '相信直觉' },
  { text: '答案没有出现时，生活仍可以继续', category: '温柔肯定' },
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
