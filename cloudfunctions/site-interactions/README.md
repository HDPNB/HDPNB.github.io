# site-interactions

只处理网站“今日共鸣”的 CloudBase 云函数。

支持：

- `getReactions`
- `react`

所有调用都必须携带现有 CloudBase 登录身份。函数只从
`cloudbase.getCloudbaseContext(context).TCB_UUID` 读取真实 UID，不接受客户端传入 UID。

## 集合

创建仅服务端可访问的 `site_reactions`：

```ts
{
  uid: string;
  page: 'home' | 'life' | 'learn' | 'projects' | 'about' | 'guestbook' | 'gallery';
  date: string;
  reaction: 'healing' | 'curious' | 'cheer' | 'miss';
  createdAt: Date;
  updatedAt: Date;
  lastReactedAt: Date;
}
```

文档 ID 是 `UID + 页面 + 日期` 的 SHA-256，不向前端返回。

## 调用权限

```json
{
  "site-interactions": {
    "invoke": "auth != null"
  }
}
```

## 推荐索引

用于每日聚合：

```text
page 升序 + date 升序 + reaction 升序
```

集合应设置为仅管理员或仅服务端访问。前端不直接读取或写入该集合。
