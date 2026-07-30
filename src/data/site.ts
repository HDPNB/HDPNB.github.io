export const siteConfig = {
  name: 'HDP的个人空间',
  url: 'https://hdpnb.github.io',
  description: '记录生活、学习、项目，以及那些不想忘记的Story。',
  homeTitle: '你终于来了\n等你好久了',
  homeSubtitle: '这里收着一些没有被匆忙带走的东西',
  homeNote: [
    '可能是一张照片、一段学习记录，也可能只是某个普通下午留下来的心情。',
    '它们并不宏大，却组成了我真实生活的一部分。',
  ],
  homeGuide: [
    '你不必按照顺序阅读，可以从一张照片开始，也可以随便点开一篇文章。',
    '这里没有标准答案，只是想替一些容易被忘记的瞬间留一个位置。',
  ],
  introTitle: '这里更新得不算勤快',
  introText: [
    '有时我会认真记录一个项目从混乱到逐渐成形的过程，有时只是放下一张路边拍到的照片，也可能隔了很久才想起来，原来还有一个小角落在等我回来。',
    '这里没有非常明确的主题。学习、生活、项目、比赛，还有偶尔的胡思乱想，大概都会慢慢出现在这里。',
  ],
  introTags: ['偶尔学习', '随手拍照', '喜欢折腾', '缓慢更新', '正在生活'],
  recentText: '生活、学习和项目常常混在一起。有些事情当时觉得普通，过一段时间再看，却会发现它们已经成为某个阶段最清晰的注脚。',
  featuredPhotosText: '不是作品集，只是一些当时舍不得删掉，也不想被时间顺手带走的画面。',
  footerText: '慢慢记录，慢慢生活。',
  nav: [
    { label: '首页', href: '/' },
    { label: '日常生活', href: '/life/' },
    { label: '学习记录', href: '/learn/' },
    { label: '我的项目', href: '/projects/' },
    { label: '关于我', href: '/about/' },
    { label: '光影', href: '/gallery/' },
    { label: '留言板', href: '/guestbook/' },
  ],
} as const;

export const aboutConfig = {
  pageTitle: '先随便认识一下',
  description: '关于HDP，也关于这个会随着生活慢慢长大的小空间。',
  lead: '关于自己的内容还没有认真想好，先留一块地方。以后遇到新的事情，再慢慢补进来。',
  now: '最近一边整理这个小站，一边继续折腾手边的板子。进度不算快，但每天都比昨天多明白一点。',
  likes: ['傍晚的风', '随手拍下的天空', '能跑起来的小项目', '安静地听歌', '不赶时间的散步'],
  goals: ['把这个小站慢慢填满', '完成一个真正好用的小设备', '多拍一些值得以后翻看的照片'],
  tags: ['慢热', '偶尔折腾', '随缘更新', '还在探索'],
  timeline: [
    { date: '现在', text: '认真生活，也顺手收集那些普通却值得记住的瞬间。' },
    { date: '以后', text: '继续写一点、拍一点，让这里慢慢长出新的故事。' },
  ],
  photos: [
    { src: '/images/life/desk.png', alt: '暖色灯光下的桌面', caption: '一张以后可以换掉的生活照片' },
    { src: '/images/campus/sunset.png', alt: '校园黄昏的天空', caption: '最近很喜欢的傍晚' },
  ],
} as const;

export const guestbookConfig = {
  title: '欢迎留下你想留下的话',
  description: '可以是一句问候、一段故事，也可以只是告诉我，你曾经路过这里。',
  composerTitle: '说点什么',
  composerNotice: '留言会先在这里安静地等一会儿。审核通过后，它才会和其他人的话一起出现。',
  placeholder: '写下一句问候、一段故事，或者今天忽然想说的话。',
} as const;

export const galleryConfig = {
  title: '访客留下的光影',
  description: [
    '有些故事不一定需要很多文字。',
    '一张照片、一点颜色、一个当时没有注意到的角落，也可能替某一天保留下最准确的记忆。',
  ],
  uploadTitle: '留下一张照片',
  uploadHint: '上传一张你愿意留在这里的照片。它不会立即公开，审核通过后才会出现在访客相册中。',
  privateHint: '选择“仅自己可见”后，照片只会在当前登录身份的个人区域中查询。清除浏览器数据或退出身份后，可能无法再次找到它。',
  publicAccessHint: '公开相册只展示审核通过的照片。图片通过短时有效的临时链接加载，过期后重新刷新即可。',
  publicEmpty: '这里还没有访客留下的照片。',
  ownEmpty: '你还没有在这里留下照片。',
} as const;

export const categories = ['校园生活', '随手记录', '旅行与摄影', 'C/C++', 'Python', '嵌入式开发', '项目进展'] as const;
export const suggestedTags = ['校园', '黄昏', '生活', '摄影', 'ESP32', 'RK3568', 'C语言', '嵌入式', '随手记'] as const;
