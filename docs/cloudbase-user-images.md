# CloudBase 用户图片配置

当前 CloudBase 套餐不支持云存储自定义安全规则，因此不再使用“公开存储目录 + 自定义存储规则”的旧方案。

请使用当前免费套餐方案：

- [`cloudbase-user-images-free-plan.md`](./cloudbase-user-images-free-plan.md)
- 云存储保持“仅创建者及管理员可读写”
- 公开图片由 `public-gallery-images` 云函数生成短时访问链接
- 不复制私密、待审核或拒绝图片到公开目录

本文件只保留为旧文档入口，避免维护时误用已废弃配置。
