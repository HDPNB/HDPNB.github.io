# CloudBase 数据库安全规则

本阶段需要把 `users` 和 `guestbook_messages` 从预设权限切换为“自定义安全规则”。规则不会因为代码部署而自动生效，必须在 CloudBase 控制台逐个集合粘贴并保存。

> Web SDK 使用 `auth.uid`。安全规则中引用了 `doc.uid` 或 `doc.status`，因此前端查询也必须包含对应的 `uid` 或 `status` 等值条件。不要改成无条件 `.get()`。

## users 集合

在“文档型数据库 → 集合管理 → users → 权限管理”中切换到安全规则，并粘贴：

```json
{
  "read": "auth != null && doc.uid == auth.uid",
  "create": "auth != null && request.data.uid == auth.uid && request.data.loginType == 'ANONYMOUS' && request.data.nickname != undefined && request.data.role == undefined && request.data.isAdmin == undefined && request.data.permissions == undefined",
  "update": "auth != null && doc.uid == auth.uid && (request.data.uid == undefined || request.data.uid == doc.uid) && (request.data.loginType == undefined || request.data.loginType == doc.loginType) && (request.data.createdAt == undefined || request.data.createdAt == doc.createdAt) && request.data.role == undefined && request.data.isAdmin == undefined && request.data.permissions == undefined",
  "delete": false
}
```

效果：

- 只有已登录用户可以创建资料。
- `uid` 必须等于真实的 `auth.uid`。
- 用户只能通过带有自己 `uid` 的查询读取和更新自己的资料。
- `uid`、`loginType` 和 `createdAt` 不能被普通用户改写。
- 客户端不能写入 `role`、`isAdmin` 或 `permissions`。
- 普通用户不能删除资料。

建议为 `uid` 创建索引。代码创建资料时使用 UID 作为 `_id`，同时仍然通过 `{ uid: auth.uid }` 条件查询。

## guestbook_messages 集合

在“文档型数据库 → 集合管理 → guestbook_messages → 权限管理”中切换到安全规则，并粘贴：

```json
{
  "read": "doc.status == 'approved' || (auth != null && doc.uid == auth.uid)",
  "create": "auth != null && request.data.uid == auth.uid && request.data.status == 'pending' && request.data.nickname != undefined && request.data.content != undefined && request.data.reply == '' && request.data.repliedAt == null && request.data.role == undefined && request.data.isAdmin == undefined && request.data.permissions == undefined && request.data.adminUid == undefined && request.data.reviewedBy == undefined && request.data.reviewedAt == undefined",
  "update": false,
  "delete": false
}
```

效果：

- 所有人只能通过 `status == 'approved'` 查询公开留言。
- 已登录用户可以通过 `uid == auth.uid` 查询自己的待审核、已通过或未通过留言。
- 新留言的 `uid` 必须来自当前认证身份。
- 新留言的状态只能是 `pending`，回复必须为空。
- 普通用户不能更新、删除、审核或回复留言。
- 审核、回复和删除只能通过 CloudBase 控制台，或后续经过身份校验的管理员云函数完成。

建议创建两个组合索引：

1. `status` 升序、`createdAt` 降序。
2. `uid` 升序、`createdAt` 降序。

## 规则边界

CloudBase 数据库规则负责身份、所有权、状态和敏感字段约束。昵称长度、留言长度和 HTML 检查当前由前端完成；浏览器校验可以被绕过，不能代替服务端内容校验。同样，浏览器内的 60 秒限频只改善正常访客体验，不能阻止恶意请求。

正式开放前，建议在后续阶段把留言创建迁移到云函数，在服务端再次校验长度、纯文本、提交频率和风险内容。本阶段没有创建云函数，也没有写入任何服务端密钥。
