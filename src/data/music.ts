export interface MusicTrack {
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
    title: '那天下雨了',
    artist: '周杰伦',
    src: '/audio/song-01.mp3',
    cover: '/images/music/song-01.webp',
    lyric: '下雨了',
  },
];



// 配置示例，不会自动加入播放列表
export const musicTrackExamples: MusicTrack[] = [
  {
    title: '示例本地歌曲',
    artist: '歌手名',
    src: '/audio/example.mp3',
    cover: '/images/music/example.webp',
    tags: ['学习', '放松'],
  },
  {
    title: '在 QQ 音乐收听',
    artist: '歌手名',
    qqMusicUrl: '',
    tags: ['日常'],
  },
];
