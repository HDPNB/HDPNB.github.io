# admin-content

受保护的内容管理云函数。它只接受已经登录且 UID 存在于 `admins`
集合中的请求，支持按状态读取内容、设置 `approved`、`rejected`、
`hidden` 状态，并可恢复 `archived` 漂流瓶，以及由管理员明确确认后删除。删除图片时先删除云存储
文件，成功后才删除数据库记录。

部署环境使用 Node.js 18，调用权限应设置为 `auth != null`。不要把
`admins`、`admin_review_tokens` 或待审核集合开放给浏览器直接读取。

部署后，在 `/admin-content/` 先通过现有 `admin-guestbook` 的 `ping`
验证，再使用本函数。操作凭据随机生成、绑定当前管理员并在 15 分钟后
过期；前端不会收到数据库文档 ID、用户 UID、文件 ID 或管理员 UID。
