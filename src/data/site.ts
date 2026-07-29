export const siteConfig = {
  name: 'HDP的个人空间',
  url: 'https://hdpnb.github.io',
  description: '记录生活、学习、项目，以及那些不想忘记的Story。',
  homeTitle: '你终于来了\n等你好久了',
  homeSubtitle: '留下你想留下的Story',
  homeNote: '这里收藏生活的片段，也保存那些不想忘记的时刻。',
  introTitle: '本人比较懒哈哈哈哈。',
  introText: '所以这里可能不会每天更新。偶尔记录生活，偶尔整理学习，也偶尔什么都不想写',
  introTags: ['偶尔学习', '随手拍照', '喜欢折腾', '缓慢更新', '正在生活'],
  footerText: '慢慢记录，慢慢生活。',
  nav: [
    { label: '首页', href: '/' },
    { label: '日常生活', href: '/life/' },
    { label: '学习记录', href: '/learn/' },
    { label: '我的项目', href: '/projects/' },
    { label: '关于我', href: '/about/' },
    { label: '留言板', href: '/guestbook/' },
  ],
} as const;

export const aboutConfig = {
  lead: '关于我的内容还没有认真想好，先留一块地方，以后慢慢写。',
  now: '最近在慢慢整理这个小站，也在继续折腾手边的板子和一些没做完的小想法。',
  likes: ['傍晚的风', '随手拍下的天空', '能跑起来的小项目', '安静地听歌', '不赶时间的散步'],
  goals: ['把这个小站慢慢填满', '完成一个真正好用的小设备', '多拍一些值得留下的照片'],
  tags: ['慢热', '偶尔折腾', '随缘更新', '还在探索'],
  timeline: [
    { date: '现在', text: '认真生活，也认真收集那些普通但值得记住的瞬间。' },
    { date: '以后', text: '这里会继续长出新的文字、照片和故事。' },
  ],
  photos: [
    { src: '/images/life/desk.png', alt: '暖色灯光下的桌面', caption: '一张以后可以换掉的生活照片' },
    { src: '/images/campus/sunset.png', alt: '校园黄昏的天空', caption: '最近很喜欢的傍晚' },
  ],
} as const;

export const categories = ['校园生活', '随手记录', '旅行与摄影', 'C/C++', 'Python', '嵌入式开发', '项目进展'] as const;
export const suggestedTags = ['校园', '黄昏', '生活', '摄影', 'ESP32', 'RK3568', 'C语言', '嵌入式', '随手记'] as const;
