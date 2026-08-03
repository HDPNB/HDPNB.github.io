export interface GameScreenshot {
  id: string;
  title: string;
  game?: string;
  note?: string;
  thumbnail: string;
  full: string;
  width: number;
  height: number;
}

/**
 * 游戏截图放在 public/images/games/。
 * 推荐同时准备缩略图和大图，例如：
 *   /images/games/celeste-01-thumb.webp
 *   /images/games/celeste-01.webp
 *
 * 只会先创建前 8 张截图，其余截图由“加载更多”按批次加入页面。
 */
export const gameScreenshots: GameScreenshot[] = [];

export const gameGalleryPageSize = 8;
