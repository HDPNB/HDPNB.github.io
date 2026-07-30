# public-gallery-images

只读的公开图库云函数。它从 `user_images` 集合固定查询
`visibility == "public"` 且 `status == "approved"` 的记录，再由服务端为这些记录中的
`fileId` 生成短时有效的图片链接。

## 运行环境

- Node.js 18
- `@cloudbase/node-sdk` 3.18.3
- 入口：`index.js`
- 导出：`main`

SDK 3.18.3 的实际类型定义为：

```ts
getTempFileURL({
  fileList: Array<string | {
    fileID: string;
    maxAge?: number;
  }>;
}): Promise<{
  fileList: Array<{
    code: string;
    fileID: string;
    tempFileURL: string;
  }>;
}>;
```

本函数传入 `{ fileID, maxAge: 1200 }`，临时链接有效期约20分钟。一次最多处理24张图片，低于
SDK 单次50个文件的限制。

## 支持的请求

```json
{
  "action": "listPublic"
}
```

可选分页参数：

```json
{
  "action": "listPublic",
  "page": 1,
  "pageSize": 24
}
```

- `page` 必须是1～50之间的整数。
- `pageSize` 必须是1～24之间的整数。
- 函数不会读取客户端传入的 `uid`、`status`、`visibility`、`fileId` 或 `cloudPath`。

## 返回字段

每张图片只返回：

- `id`
- `nickname`
- `description`
- `width`
- `height`
- `createdAt`
- `tempUrl`
- `expiresAt`

不会返回上传者 UID、文件 ID、云路径、审核人或管理员信息。

## 部署

1. 在 CloudBase 控制台创建名为 `public-gallery-images` 的云函数。
2. 运行环境选择 Node.js 18。
3. 上传本目录中的 `index.js` 与 `package.json`，或使用现有 CloudBase CLI 部署流程。
4. 确认依赖安装完成，入口为 `index.main`。
5. 配置函数调用权限：

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

6. 使用 `{ "action": "listPublic" }` 测试。没有已审核公开图片时应返回空数组。

函数不执行上传、审核、更新或删除操作。请勿在代码中加入 SecretId、SecretKey、管理员 UID
或客户端传入文件 ID 的换链逻辑。
