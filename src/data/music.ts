export interface MusicTrack {
  title: string;
  artist: string;
  cover: string;
  src: string;
  tags: string[];
  qqMusicUrl?: string;
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
export const musicTracks: MusicTrack[] = [];
