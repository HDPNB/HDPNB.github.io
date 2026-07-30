# CloudBase 免费套餐公开图库配置

本文对应网站 `/gallery/` 页面和 `public-gallery-images` 云函数。当前方案专门适配“不支持云存储自定义安全规则”的套餐。

核心边界：

- 云存储保持基础权限“仅创建者及管理员可读写”。
- 不启用云存储自定义安全规则。
- 文件始终保存在上传者目录中，不复制到公开目录。
- 浏览器不能直接为公开图库中的任意 `fileId` 获取链接。
- 只有只读云函数可以为数据库中 `public + approved` 的记录换取短时链接。

官方参考：

- [Node SDK 云存储](https://docs.cloudbase.net/api-reference/server/node-sdk/storage)
- [SDK 管理文件](https://docs.cloudbase.net/storage/sdk)
- [文档型数据库安全规则](https://docs.cloudbase.net/database/security-rules/)

## 1. 保持云存储基础权限

进入 CloudBase 控制台的云存储权限设置：

1. 选择“仅创建者及管理员可读写”。
2. 不切换成“所有用户可读”。
3. 不启用自定义安全规则。
4. 不创建公开存储目录。

浏览器上传的文件继续保存在：

```text
user-images/{uid}/{year}/{month}/{timestamp}-{random}.webp
```

公开、私密、待审核和拒绝图片都保留在原上传者目录中。公开访问只改变数据库审核状态，不改变文件基础权限。

## 2. 数据库配置

保持已经创建的 `user_images` 集合和现有安全规则。

需要的索引：

1. `uid` 升序 + `createdAt` 降序。
2. `visibility` 升序 + `status` 升序 + `createdAt` 降序。

公开图库云函数固定查询：

```js
{
  visibility: 'public',
  status: 'approved'
}
```

浏览器的“我的图片”查询固定包含当前认证 UID：

```js
{
  uid: currentAuthUid
}
```

不要把 `user_images` 改成允许浏览器无条件读取整个集合。

## 3. 创建云函数

1. 打开 CloudBase 控制台。
2. 进入“云函数”，创建 `public-gallery-images`。
3. 运行环境选择 Node.js 18。
4. 上传 `cloudfunctions/public-gallery-images/` 目录中的：
   - `index.js`
   - `package.json`
5. 入口配置为 `index.main`。
6. 安装依赖并部署。
7. 不配置 SecretId、SecretKey、Token、管理员 UID 或额外管理密钥。

依赖固定为：

```json
{
  "@cloudbase/node-sdk": "3.18.3"
}
```

SDK 3.18.3 的类型和源码均支持：

```js
app.getTempFileURL({
  fileList: [
    {
      fileID,
      maxAge: 1200
    }
  ]
});
```

`maxAge: 1200` 表示链接有效期约20分钟。

## 4. 云函数调用权限

把云函数调用权限设置为：

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
  }
}
```

`public-gallery-images` 可以公开调用，是因为它同时满足以下限制：

- 只支持 `listPublic`。
- 服务端固定查询 `visibility == "public"`。
- 服务端固定查询 `status == "approved"`。
- 一次最多读取24条。
- 页码最多50页。
- 不接受客户端传入任意 `fileId`、`cloudPath`、UID、可见范围或审核状态。
- 不执行数据库写入、审核、文件上传或删除。
- 只返回展示所需的白名单字段。

公开调用只代表访客可以请求“已批准的公开列表”，不代表访客拥有云存储管理员权限。

## 5. 返回字段

每一项只返回：

```ts
{
  id: string;
  nickname: string;
  description: string;
  width: number;
  height: number;
  createdAt: string;
  tempUrl: string;
  expiresAt: string;
}
```

不会返回：

- `uid`
- `_openid`
- `fileId`
- `cloudPath`
- `reviewedBy`
- 管理员身份信息

## 6. 审核图片

没有图片审核后台时，继续在控制台人工审核：

1. 查询 `user_images` 中 `status == "pending"` 的记录。
2. 检查图片内容、描述、可见范围和尺寸。
3. 公开图片审核通过时：
   - 确认 `visibility` 原本就是 `public`；
   - 把 `status` 改为 `approved`；
   - 写入可信的 `reviewedAt` 和 `reviewedBy`。
4. 拒绝时把 `status` 改为 `rejected`。
5. 私密图片保持 `visibility == "private"`，不要改成公开。
6. 不复制私密、待审核或拒绝图片到任何公开目录。

即使数据库记录变成 `approved`，云存储仍保持“仅创建者及管理员可读写”；公开访客只能通过云函数签发的短时链接查看。

## 7. 部署后测试

先直接测试云函数：

```json
{
  "action": "listPublic"
}
```

预期：

- 没有公开已审核图片时，返回 `ok: true` 和空数组。
- 有公开已审核图片时，每项只有白名单字段。
- `tempUrl` 可以在有效期内打开。
- `expiresAt` 大约晚于生成时间20分钟。

再测试非法请求：

```json
{
  "action": "unknown"
}
```

应返回：

```json
{
  "ok": false,
  "code": "INVALID_ACTION",
  "message": "不支持的操作。"
}
```

以下请求必须被拒绝：

```json
{
  "action": "listPublic",
  "fileId": "cloud://任意文件"
}
```

继续验证：

1. `private + pending` 不返回。
2. `private + approved` 不返回。
3. `public + pending` 不返回。
4. `public + rejected` 不返回。
5. `public + approved` 才能返回。
6. 某个文件换链失败时，其余图片仍可返回。
7. 返回内容不包含 UID、文件 ID 或云路径。

## 8. 本地网站测试

项目根目录准备未提交的 `.env`：

```dotenv
PUBLIC_CLOUDBASE_ENABLED=true
PUBLIC_CLOUDBASE_ENV_ID=你的环境ID
```

运行：

```powershell
npm install
npm run dev
```

打开：

```text
http://localhost:4321/gallery/
```

确认：

- 公开相册通过云函数加载。
- 未登录时“我的图片”显示登录引导。
- 登录后只能查询当前 UID 的记录。
- 私密图片只出现在上传者自己的区域。
- 待审核、已公开、未通过使用不同中文状态。
- 图片链接过期或加载失败时出现“重新加载”。
- 不会自动无限重试。

## 9. 线上测试

1. 把 `hdpnb.github.io` 保留在 Web 安全域名。
2. 部署 `public-gallery-images` 云函数。
3. 应用云函数调用权限配置。
4. 按现有流程自行发布网站前端。
5. 打开线上 `/gallery/`。
6. 使用两个不同游客身份测试私密隔离。
7. 审核一张公开图片，确认只有审核后才出现在公开相册。
8. 等待临时链接过期，再点击“重新加载”确认可以重新获取。

## 10. 临时链接安全边界

临时链接过期是预期行为，不应保存为永久链接。

任何获得临时链接的人，在链接有效期内都可能访问对应图片。因此：

- 有效期固定为20分钟，不要设置成数小时或永久。
- 不在构建产物中写入临时链接。
- 不在日志中打印临时链接。
- 不把临时链接保存回数据库。
- 不通过社交分享或页面文本暴露临时链接。

短时链接降低长期暴露风险，但不能撤回已经被他人在有效期内复制的链接。

## 11. 日志与运维

云函数日志只记录：

- 请求页码和每页数量。
- 查询条数和最终返回条数。
- 错误阶段、错误名称和错误码。

日志不记录：

- 完整临时链接。
- 完整 UID。
- 文件 ID。
- 云路径。
- Token 或环境密钥。

公开调用仍会消耗云函数、数据库和云存储流量。建议在控制台设置预算告警、调用量监控和合理的函数并发限制。

## 12. 当前安全边界

已完成：

- 公开列表固定查询 `public + approved`。
- 服务端读取 `fileId` 并生成短时链接。
- 客户端无法为任意文件请求链接。
- 公开响应采用严格字段白名单。
- 单张换链失败不会影响其他成功图片。
- 上传固定写入 `pending`。
- 数据库写入失败时尽力清理孤立文件。
- 私密和待审核记录不会进入公开列表。

仍需控制台和可信后端保证：

- 管理员审核过程的真实性。
- 云函数调用量控制和服务端限流。
- 恶意图片内容检测。
- 孤立文件定期清理。
- 用户删除图片时的跨数据库、云存储一致性。
