export type Project = {
  slug: string;
  name: string;
  shortName: string;
  cover: string;
  intro: string;
  tech: string[];
  period: string;
  status: string;
  features: string[];
  background: string;
  goal: string;
  composition: string[];
  contribution: string[];
  hardware: string[];
  software: string[];
  process: string[];
  problem: string;
  solution: string;
  result: string;
  improvements: string[];
  timeline: { date: string; text: string }[];
  gallery: { src: string; alt: string; caption: string }[];
};

export const projects: Project[] = [
  {
    slug: 'esp32-environment-monitor',
    name: 'ESP32智能环境监测系统',
    shortName: 'ESP32环境监测',
    cover: '/images/projects/esp32.png',
    intro: '把温湿度、光照、烟雾和安防控制装进一个小小的日常实验里。',
    tech: ['ESP32', '嵌入式C', 'Flutter', 'MQTT', '传感器', '物联网'],
    period: '2025.10 — 2026.03',
    status: '持续改进中',
    features: ['温湿度监测', '光照检测', '烟雾检测', '安防报警', '舵机控制', '蜂鸣器控制', '手机APP', '云端通信', '设备在线状态'],
    background: '最初只是想知道寝室里的温湿度，后来传感器越接越多，慢慢变成了一套完整的小系统。',
    goal: '让环境数据能被稳定采集、远程查看，并在异常时给出及时但不过分吵闹的提醒。',
    composition: ['ESP32主控与多类传感器', 'MQTT消息通信', 'Flutter移动端', '报警与执行机构'],
    contribution: ['完成硬件连接与嵌入式程序', '设计MQTT主题和消息格式', '制作移动端交互页面', '联调在线状态与报警逻辑'],
    hardware: ['ESP32开发板', '温湿度与光照传感器', '烟雾传感器', '舵机与蜂鸣器'],
    software: ['嵌入式C任务调度', 'MQTT通信', 'Flutter状态展示', '设备心跳与掉线判断'],
    process: ['先完成单个传感器读取', '统一数据结构并接入网络', '补齐执行器控制', '最后制作移动端并反复联调'],
    problem: '传感器数据偶尔抖动，网络短暂断开时也会出现状态误判。',
    solution: '增加滑动平均、阈值回差和心跳超时机制，让读数与在线状态都更稳定。',
    result: '目前可以持续显示环境数据、远程控制舵机与蜂鸣器，并判断设备在线和离线。',
    improvements: ['把外壳做得更小一点', '补充历史曲线', '优化弱网下的重连体验'],
    timeline: [
      { date: '第一周', text: '点亮开发板，逐个读取传感器。' },
      { date: '第三周', text: '接入MQTT，第一次在手机上看到实时数据。' },
      { date: '后来', text: '补齐报警、控制和在线状态，继续修小问题。' },
    ],
    gallery: [
      { src: '/images/projects/esp32.png', alt: 'ESP32环境监测系统桌面原型', caption: '桌面原型与传感器接线' },
      { src: '/images/projects/app.png', alt: '手机端环境数据界面', caption: '移动端的轻量控制界面' },
    ],
  },
  {
    slug: 'rk3568-player',
    name: 'RK3568便携式播放器',
    shortName: 'RK3568播放器',
    cover: '/images/projects/rk3568.png',
    intro: '一台能读取U盘、触摸操作，也能安静播放本地音视频的小设备。',
    tech: ['RK3568', 'Linux', 'Qt', 'QML', 'GStreamer'],
    period: '2025.06 — 2025.09',
    status: '主要功能完成',
    features: ['本地音视频播放', 'U盘文件读取', '触摸操作', '播放控制', '音量控制', '播放进度', 'Qt/QML界面'],
    background: '想做一个真正能拿在手里使用的播放器，而不只是停留在开发板上的演示窗口。',
    goal: '在嵌入式Linux设备上完成一套简洁的本地媒体浏览与播放体验。',
    composition: ['RK3568开发板', '触摸屏与音频输出', 'U盘文件扫描', 'Qt/QML界面与GStreamer播放'],
    contribution: ['搭建播放器整体界面', '实现媒体文件扫描', '连接播放、进度和音量控制', '处理触摸屏上的交互细节'],
    hardware: ['RK3568核心板', '触摸显示屏', '扬声器与音频模块', 'USB存储设备'],
    software: ['Linux设备环境', 'Qt/QML界面', 'GStreamer播放管线', '文件类型筛选'],
    process: ['确认音视频解码能力', '完成最小播放链路', '加入文件列表与U盘读取', '调整触摸交互和界面布局'],
    problem: '拖动进度条时，播放器回传的进度会和手势更新互相抢状态。',
    solution: '把“正在拖动”和“正常播放”拆成两个状态，松手后再统一提交跳转位置。',
    result: '已经能稳定读取U盘中的常见媒体文件，并完成播放、暂停、进度与音量操作。',
    improvements: ['保存上次播放位置', '加入更友好的封面提取', '继续缩短启动时间'],
    timeline: [
      { date: '起点', text: '先让一段视频在屏幕上顺利播放。' },
      { date: '中途', text: '加入QML界面、文件列表与触摸控制。' },
      { date: '现在', text: '主要功能完成，继续打磨使用体验。' },
    ],
    gallery: [
      { src: '/images/projects/rk3568.png', alt: 'RK3568播放器界面', caption: '播放器的主界面' },
      { src: '/images/projects/player-detail.png', alt: '播放器控制细节', caption: '播放进度与触摸控制' },
    ],
  },
  {
    slug: 'electronic-design-contest',
    name: '电子设计竞赛控制项目',
    shortName: '电子设计竞赛',
    cover: '/images/projects/contest.png',
    intro: '几个人、几块板子和一个紧凑的赛程，最后留下了一段很难忘的协作经历。',
    tech: ['STM32', 'C语言', '串口通信', '运动控制'],
    period: '2025.07 — 2025.08',
    status: '省级二等奖',
    features: ['STM32控制', 'UART坐标通信', '步进电机控制', '舵机控制', '线性插值算法', '视觉模块协同', '省级二等奖'],
    background: '比赛时间很紧，每个人都需要把自己的模块做稳，再一起面对那些只在联调时出现的问题。',
    goal: '让控制端可靠接收视觉坐标，驱动步进电机和舵机完成连续、准确的动作。',
    composition: ['STM32控制板', '视觉识别模块', '步进电机与驱动器', '舵机机构与串口链路'],
    contribution: ['编写主控状态机', '定义UART坐标协议', '实现电机与舵机控制', '使用线性插值平滑运动'],
    hardware: ['STM32主控', '步进电机及驱动', '舵机结构', '视觉模块'],
    software: ['C语言状态机', 'UART通信解析', '线性插值', '运动边界保护'],
    process: ['先让各个执行机构独立动作', '接入视觉坐标通信', '加入插值和边界限制', '在赛场条件下反复联调'],
    problem: '视觉坐标跳变时，机构会出现突然加速和过冲。',
    solution: '对输入坐标做有效性判断，并使用线性插值拆分运动步长，限制单次变化。',
    result: '系统完成了比赛要求的控制任务，团队最终获得省级二等奖。',
    improvements: ['增加更系统的标定流程', '减少线缆与接口故障点', '把调试参数集中到配置页'],
    timeline: [
      { date: '准备期', text: '拆分任务，确定通信格式与机械边界。' },
      { date: '比赛中', text: '不断联调，也不断发现之前想不到的小问题。' },
      { date: '结束后', text: '获得省级二等奖，也记住了团队一起熬过的夜晚。' },
    ],
    gallery: [
      { src: '/images/projects/contest.png', alt: '电子设计竞赛控制装置', caption: '比赛期间的控制装置' },
      { src: '/images/projects/motor.png', alt: '步进电机与控制电路', caption: '电机与控制部分' },
    ],
  },
];
