# site-interactions

网站互动角落的 CloudBase 云函数，运行环境为 Node.js 18。

支持今日共鸣、每日抽签、今日记忆卡、星空墙、漂流瓶和个人时光胶囊。
所有写入、个人读取和每日限次都只使用
`cloudbase.getCloudbaseContext(context).TCB_UUID` 中的真实身份，不接受
客户端 UID。`getPublicStars` 是唯一可以不登录调用的 action。

核心集合：

- `site_reactions`
- `daily_interactions`
- `visitor_stars`
- `drift_bottles`
- `drift_bottle_responses`
- `time_capsules`
- `interaction_limits`

这些集合应设置为仅管理员/仅服务端访问，浏览器不直接读写。完整权限、
索引、部署和验收步骤见 `docs/cloudbase-interaction-corner.md`。

每日抽签与记忆卡按北京时间日期计算，每项每天最多三次。写入在数据库
事务中完成；每次抽取还带有随机请求 ID，同一请求被重试时会返回原结果，
不会再次扣次数。

漂流瓶也由服务端事务分配：只选择 `approved` 内容，排除创建者、当天已经
看过的瓶子和最近看过的瓶子，并优先选择阅读次数较少、较久没有出现的
记录。每次阅读后冷却 6 小时；累计 40 次或创建满 180 天后进入
`archived`。旧记录缺少流转字段时按 0 次阅读、立即可用处理。
