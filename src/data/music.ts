export interface MusicTrack {
  id: string;
  title: string;
  artist?: string;
  cover?: string;
  src?: string;
  tags?: string[];
  qqMusicUrl?: string;
  lyric?: string;
}

/**
 * 只添加你有权公开播放的本地音频。
 * 文件放在 public/audio/，src 使用 /audio/ 开头的站内路径。
 *
 * 示例：
 * {
 *   title: '歌曲名',
 *   artist: '艺术家',
 *   cover: '/images/life/my_day.webp',
 *   src: '/audio/song.mp3',
 *   tags: ['轻音乐', '学习', '放松'],
 *   qqMusicUrl: 'https://y.qq.com/...',
 * }
 */

export const musicTracks: MusicTrack[] = [
  {
    id: 'song-01',
    title: '晴天',
    artist: '周杰伦',
    src: '/audio/song-01.mp3',
    cover: '/images/music/song-01.webp',
  },
  {
    id: 'song-02',
    title: '那天下雨了',
    artist: '周杰伦',
    src: '/audio/song-02.mp3',
    cover: '/images/music/song-01.webp',
  },
  {
    id: 'song-03',
    title: '安静',
    artist: '周杰伦',
    src: '/audio/song-03.mp3',
    cover: '/images/music/song-01.webp',
  },
  {
    id: 'song-04',
    title: '稻香',
    artist: '周杰伦',
    src: '/audio/song-04.mp3',
    cover: '/images/music/song-01.webp',
  },
  {
    id: 'song-05',
    title: '简单爱',
    artist: '周杰伦',
    src: '/audio/song-05.mp3',
    cover: '/images/music/song-01.webp',
  },
  {
    id: 'song-06',
    title: '半岛铁盒',
    artist: '周杰伦',
    src: '/audio/song-06.mp3',
    cover: '/images/music/song-01.webp',
  },
  {
    id: 'song-07',
    title: '等你下课',
    artist: '周杰伦',
    src: '/audio/song-07.mp3',
    cover: '/images/music/song-01.webp',
  },
  {
    id: 'song-08',
    title: '给我一首歌的时间',
    artist: '周杰伦',
    src: '/audio/song-08.mp3',
    cover: '/images/music/song-01.webp',
  },
  {
    id: 'song-09',
    title: '告白气球',
    artist: '周杰伦',
    src: '/audio/song-09.mp3',
    cover: '/images/music/song-01.webp',
  },
  {
    id: 'song-10',
    title: '龙卷风',
    artist: '周杰伦',
    src: '/audio/song-10.mp3',
    cover: '/images/music/song-01.webp',
  },
  {
    id: 'song-11',
    title: '说好的幸福呢',
    artist: '周杰伦',
    src: '/audio/song-11.mp3',
    cover: '/images/music/song-01.webp',
  },
  {
    id: 'song-12',
    title: '湘女多情',
    artist: '周杰伦',
    src: '/audio/song-12.mp3',
    cover: '/images/music/song-01.webp',
  },
  {
    id: 'song-13',
    title: 'My Soul（我的灵魂）',
    artist: 'July',
    src: '/audio/song-13.mp3',
    cover: '/images/music/song-02.png',
  },
];



// 配置示例，不会自动加入播放列表
export const musicTrackExamples: MusicTrack[] = [
  {
    id: 'example-local',
    title: '示例本地歌曲',
    artist: '歌手名',
    src: '/audio/example.mp3',
    cover: '/images/music/example.webp',
    tags: ['学习', '放松'],
  },
  {
    id: 'example-qq-music',
    title: '在 QQ 音乐收听',
    artist: '歌手名',
    qqMusicUrl: '',
    tags: ['日常'],
  },
];
