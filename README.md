# HDP的个人空间

一个使用 Astro、TypeScript、Markdown/MDX 构建的静态个人博客。网站用于记录生活、校园、学习、旅行摄影和个人项目，不依赖数据库或付费服务。

## 项目目录

```text
.
├── .github/workflows/deploy.yml       # GitHub Pages 自动部署
├── public/
│   ├── audio/                         # 有权公开播放的本地音频
│   ├── files/
│   ├── images/
│   │   ├── avatar/
│   │   ├── campus/
│   │   ├── life/
│   │   ├── placeholders/
│   │   ├── posts/
│   │   ├── projects/
│   │   └── travel/
│   ├── favicon.svg
│   └── robots.txt
├── src/
│   ├── components/                    # 导航、卡片、画廊、评论等组件
│   ├── content/
│   │   ├── blog/                      # Markdown/MDX 文章
│   │   └── config.ts                  # 文章字段定义
│   ├── data/
│   │   ├── giscus.ts                  # 留言配置
│   │   ├── photos.ts                  # 首页照片
│   │   ├── projects.ts                # 项目资料
│   │   └── site.ts                    # 网站、首页和关于我配置
│   ├── layouts/
│   ├── pages/
│   │   ├── blog/[...slug].astro
│   │   ├── learn/index.astro
│   │   ├── life/index.astro
│   │   ├── projects/
│   │   ├── 404.astro
│   │   ├── about.astro
│   │   ├── guestbook.astro
│   │   ├── index.astro
│   │   ├── rss.xml.js
│   │   └── search.astro
│   ├── styles/global.css
│   └── utils/content.ts
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## 1. 安装项目

建议使用 Node.js 20。进入项目目录后运行：

```bash
npm install
```

## 2. 本地运行

```bash
npm run dev
```

终端会显示本地地址，通常是 `http://localhost:4321`。正式构建使用：

```bash
npm run build
```

构建结果会生成到 `dist/`。

## 3. 发布新文章

在 `src/content/blog/` 新建 `.md` 或 `.mdx` 文件，并使用下面的头部字段：

```yaml
---
title: 文章标题
description: 一句话摘要
pubDate: 2026-07-29
updatedDate: 2026-07-29
category: 随手记录
tags: [生活, 随手记]
cover: /images/posts/example.webp
draft: false
featured: false
---
```

`draft: true` 的文章不会出现在网站中。文件名会成为文章网址的一部分，建议使用简短英文或拼音。

## 4. 添加照片

把图片放入 `public/images/` 下对应目录，然后在文章或配置中使用从 `/images/` 开始的路径。

```md
![校园黄昏](/images/campus/my-sunset.webp)
```

推荐优先使用 WebP，保留合理尺寸，并写清楚 alt 文字。首页精选照片在 `src/data/photos.ts` 中维护；图片点击放大、懒加载和说明文字由现有组件自动处理。

## 5. 修改首页文字

编辑 `src/data/site.ts` 中的：

- `homeTitle`
- `homeSubtitle`
- `homeNote`
- `introTitle`
- `introText`
- `introTags`

导航和页脚文字也集中在同一文件。

## 配置音乐播放器

1. 把你有权公开播放的音频放入 `public/audio/`。
2. 在 `src/data/music.ts` 的 `musicTracks` 数组中添加歌曲。
3. `src` 必须是 `/audio/` 开头的本地路径；QQ音乐地址只能填写在可选的 `qqMusicUrl` 中，作为外部跳转。

```ts
{
  title: '歌曲名',
  artist: '艺术家',
  cover: '/images/life/my_day.webp',
  src: '/audio/song.mp3',
  tags: ['轻音乐', '学习', '放松'],
  qqMusicUrl: 'https://y.qq.com/...',
}
```

`tags` 用于播放器内筛选，可以使用“轻音乐”“学习”“放松”“日常”等自定义标签。`qqMusicUrl` 只会显示“前往QQ音乐收听”外部链接，不会作为音频源。

播放器不会在首次进入网站时自动有声播放。当前歌曲、进度、音量、播放模式、最近播放和收藏会保存在访客自己的浏览器中；搜索词和标签筛选不会长期保存。

## 6. 修改“关于我”

编辑 `src/data/site.ts` 中的 `aboutConfig`。可以修改介绍、最近在做什么、喜欢的事情、目标、标签、时间线和照片，不需要改页面代码。

## 7. 配置留言板

1. 准备一个启用了 Discussions 的公开仓库。
2. 在 giscus 网站完成安装并选择讨论分类。
3. 把获得的参数填写到 `src/data/giscus.ts`。
4. 将 `enabled` 改为 `true`。
5. 本地分别检查浅色与深色模式。

仓库参数只保存在配置文件中，访客页面不会显示仓库地址。未配置时，网站显示友好的准备中占位。

## 8. 部署到 GitHub Pages

1. 将项目推送到用于 `hdpnb.github.io` 的仓库，默认分支命名为 `main`。
2. 在仓库设置的 Pages 页面中，把构建来源设为 GitHub Actions。
3. 推送后，`.github/workflows/deploy.yml` 会自动安装并构建网站。
4. `astro.config.mjs` 已设置 `site: https://hdpnb.github.io` 和 `base: /`。

以后绑定自定义域名时，在 `public/CNAME` 写入域名，并同步修改 `astro.config.mjs` 和 `src/data/site.ts` 的网址。

## 9. 检查部署是否成功

在 Actions 页面确认部署流程全部通过，然后依次检查：

- 首页、文章页和项目详情页能直接打开
- 刷新子页面不会出现 404
- 图片、CSS 和交互正常
- `/rss.xml` 可访问
- `/sitemap-index.xml` 可访问
- 手机和电脑上都能切换明暗主题

## 10. 维护和更新

- 写作与照片尽量放在 `src/content/` 和 `public/images/`，避免直接修改文章页面组件。
- 改动前先运行 `npm run dev` 预览。
- 发布前运行 `npm run build`。
- 定期压缩大图并优先使用 WebP。
- 升级依赖后重新检查首页、文章渲染、RSS 与站点地图。
- 不要把密码、Token 或个人敏感信息写入项目。
