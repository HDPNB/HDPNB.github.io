# 今日共鸣：CloudBase 配置

“今日共鸣”只保存四种固定选项，不保存文本，也不展示用户列表。前端只能调用云函数，不能直接读写 `site_reactions` 集合。

## 1. 创建集合

在当前 CloudBase 环境中创建集合：

```text
site_reactions
```

将集合权限设为仅管理员可读写（ADMINONLY）。不要开放浏览器端直接读取或写入。

每份文档由云函数固定写入：

```ts
{
  uid: string,
  page: 'home' | 'life' | 'learn' | 'projects' | 'about' | 'guestbook' | 'gallery',
  date: 'YYYY-MM-DD',
  reaction: 'healing' | 'curious' | 'cheer' | 'miss',
  createdAt: Date,
  updatedAt: Date,
  lastReactedAt: Date
}
```

文档 `_id` 由服务端根据 UID、页面和日期生成摘要。同一身份在同一页面同一天只有一份记录；更换选项会更新原记录，不会重复累加。

## 2. 推荐索引

为聚合查询创建组合索引：

```text
page 升序 + date 升序 + reaction 升序
```

云函数只会在固定页面、当天日期和固定互动类型上计数。

## 3. 部署云函数

1. 在 CloudBase 控制台进入“云函数”。
2. 新建 Node.js 18 云函数 `site-interactions`。
3. 上传项目中的 `cloudfunctions/site-interactions` 目录，或使用 CloudBase CLI 从该目录部署。
4. 安装生产依赖并等待部署完成。
5. 不要在函数环境变量中放置管理员 UID；本函数不需要管理员身份配置。

## 4. 调用权限

在云函数调用权限中合并以下规则。不要覆盖掉已经在使用的函数：

```json
{
  "*": {
    "invoke": false
  },
  "admin-guestbook": {
    "invoke": "auth != null"
  },
  "public-gallery-images": {
    "invoke": true
  },
  "site-interactions": {
    "invoke": "auth != null"
  }
}
```

`site-interactions` 必须携带真实 CloudBase 登录身份。网页未登录时只显示登录提示，不会创建或伪造 UID。

## 5. 安全边界

- 前端不能提交 UID、日期、计数、集合名、查询条件或数据库字段。
- 云函数只接受 `getReactions` 和 `react`。
- 页面和互动类型均使用服务端白名单。
- 返回值只包含页面、日期、四项计数和当前用户的选项。
- 返回值不包含 UID、文档 ID 或数据库原始记录。
- 三秒冷却用于降低连续切换频率；它不是通用反自动化系统。
- 匿名身份清除或退出后可能无法恢复，因此新身份会被视为另一位访客。

## 6. 测试

1. 先用网站的“游客进入”完成匿名登录。
2. 打开首页，确认四项计数能正常读取。
3. 点击一个选项，刷新页面，确认选择和计数仍然存在。
4. 换一个选项，确认旧选项计数减少、新选项计数增加，总记录数不增加。
5. 退出身份，确认页面提示先以游客身份进入。
6. 直接传入未知 action、页面或互动类型时，应返回安全错误。

CloudBase 控制台直接测试通常不携带网站登录身份，因此返回 `NOT_LOGGED_IN` 是预期行为。
