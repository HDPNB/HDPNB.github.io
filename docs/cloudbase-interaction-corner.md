# CloudBase 互动角落配置

本文对应以下页面和云函数：

- `/interactions/`
- `/star-wall/`
- `/drift-bottle/`
- `/time-capsule/`
- `/answer-book/`
- `/admin-content/`
- `site-interactions`
- `admin-content`

答案之书只在浏览器内运行，不上传问题，也不需要数据库集合。其他联网
互动使用现有匿名认证；匿名身份丢失后，服务端不会把旧身份的数据转交给
新身份。

## 1. 新增集合与权限

以下集合全部设置为“仅管理员可读写”或控制台中等价的服务端专用权限。
不要授予 Web SDK 直接读写权限：

| 集合 | 用途 |
| --- | --- |
| `daily_interactions` | 每日抽签、记忆卡、星星和漂流瓶次数 |
| `visitor_stars` | 待审核与公开星星 |
| `drift_bottles` | 待审核与公开漂流纸条 |
| `drift_bottle_responses` | 固定回应去重与计数 |
| `time_capsules` | 当前身份的私密胶囊正文 |
| `interaction_limits` | 未删除胶囊数量与访客最近看过的漂流瓶 |
| `admin_review_tokens` | 15 分钟有效、绑定管理员的审核凭据 |

继续保留已有 `site_reactions`、`users`、`admins`、
`guestbook_messages`、`user_images` 及其现有权限。不要把 `admins` 或
`admin_review_tokens` 开放给普通用户。

### `daily_interactions`

```ts
{
  uid: string;
  date: string; // Asia/Shanghai，YYYY-MM-DD
  action:
    | 'drawFortune'
    | 'drawMemoryCard'
    | 'createStar'
    | 'createBottle'
    | 'drawBottle';
  count: number;
  results: Array<number | string>;
  requests?: Array<
    | { id: string; index: number }
    | { id: string; bottleId: string }
  >;
  createdAt: Date;
  updatedAt: Date;
}
```

抽签和记忆卡使用 `uid + date + action` 的 SHA-256 作为文档 ID。事务先
读取现有次数，再判断上限并写回；`requests` 用于识别同一网络请求的重试。

### `visitor_stars`

```ts
{
  uid: string;
  nickname: string;
  message: string; // 1～30
  mood: 'healing' | 'miss' | 'happy' | 'calm' | 'hope' | 'cheer';
  color: 'sage' | 'gold' | 'blue' | 'rose' | 'cream';
  status: 'pending' | 'approved' | 'rejected' | 'hidden' | 'archived';
  deliveryCount: number; // 缺失时兼容为 0
  lastDeliveredAt: Date | null;
  nextAvailableAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
}
```

公开接口固定查询 `status == approved`，只返回昵称、短句、心情、颜色和
日期，不返回 UID、文档 ID 或审核信息。每个身份每天最多创建一颗。

### `drift_bottles`

```ts
{
  uid: string;
  content: string; // 1～80
  category: 'mood' | 'unsaid' | 'blessing' | 'worry' | 'good-news';
  publicToken: string; // 服务端随机生成
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
}
```

服务端只从 `approved` 中抽取，排除当前 UID、当天已捞取记录和最近一只
瓶子。候选最多读取 24 条，优先选择阅读次数较少、较久没有出现的记录；
分配与每日次数写入在同一个事务中完成。每次阅读后冷却 6 小时，累计
40 次或创建满 180 天后进入 `archived`。归档不是删除，管理员可以在内容
管理页恢复。旧文档缺少新增字段时按 0 次阅读、立即可用处理。

浏览器只得到随机 `publicToken`，不会得到数据库文档 ID。每个身份每天
投递一次、捞取三次。

### `drift_bottle_responses`

```ts
{
  uid: string;
  bottleId: string;
  response: 'hug' | 'received' | 'cheer' | 'happy-for-you' | 'wish';
  createdAt: Date;
}
```

文档 ID 由 UID 与瓶子文档 ID 哈希生成；同一身份对同一瓶子只能回应一次。
原始记录不会返回前端。

### `time_capsules`

```ts
{
  uid: string;
  capsuleToken: string;
  title: string; // 1～30
  content: string; // 1～200
  unlockAt: Date;
  status: 'active' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

列表接口只返回标题、创建时间、解锁时间与服务端计算的剩余时间。正文只
在 `openCapsule` 同时确认真实 UID、随机 token、active 状态和服务端时间
已到后返回。删除时正文会清空。

### `interaction_limits`

```ts
{
  uid: string;
  activeCapsules?: number;
  recentBottleIds?: string[]; // 最多 12 条，只在服务端使用
  createdAt: Date;
  updatedAt: Date;
}
```

创建和删除胶囊都在事务中同步更新计数，最多保留 10 枚未删除胶囊。

## 2. 推荐索引

在文档型数据库中创建以下组合索引。除特别标注外均为升序：

| 集合 | 字段顺序 |
| --- | --- |
| `site_reactions` | `page` 升序、`date` 升序、`reaction` 升序 |
| `visitor_stars` | `status` 升序、`createdAt` 降序 |
| `visitor_stars` | `uid` 升序、`createdAt` 降序 |
| `drift_bottles` | `status` 升序、`nextAvailableAt` 升序 |
| `drift_bottles` | `status` 升序、`createdAt` 升序 |
| `drift_bottles` | `status` 升序、`createdAt` 降序 |
| `drift_bottles` | `uid` 升序、`createdAt` 降序 |
| `drift_bottles` | `publicToken` 升序 |
| `drift_bottle_responses` | `bottleId` 升序、`response` 升序 |
| `time_capsules` | `uid` 升序、`status` 升序、`createdAt` 降序 |
| `time_capsules` | `uid` 升序、`capsuleToken` 升序、`status` 升序 |
| `guestbook_messages` | `status` 升序、`createdAt` 降序 |
| `user_images` | `status` 升序、`createdAt` 降序 |

`daily_interactions`、`interaction_limits` 和 `admin_review_tokens` 通过
确定文档 ID 读取，不需要组合索引。若控制台启用了 TTL 清理能力，可以对
`admin_review_tokens.expiresAt` 配置过期清理；没有 TTL 时定期在控制台
删除过期记录即可，过期记录本身也不能继续审核。

## 3. 云函数部署

### `site-interactions`

1. 创建或更新同名云函数。
2. 运行环境选择 Node.js 18。
3. 上传 `cloudfunctions/site-interactions/`。
4. 入口为 `index.main`。
5. 安装依赖并部署。

### `admin-content`

1. 创建 `admin-content` 云函数。
2. 运行环境选择 Node.js 18。
3. 上传 `cloudfunctions/admin-content/`。
4. 入口为 `index.main`。
5. 安装依赖并部署。

不要配置 SecretId、SecretKey、管理员 UID、Token 或前端管理员密码。
管理员身份只由现有 `admins` 集合和云函数认证上下文判断。

## 4. 调用权限

推荐调用权限：

```json
{
  "*": {
    "invoke": false
  },
  "admin-guestbook": {
    "invoke": "auth != null"
  },
  "admin-content": {
    "invoke": "auth != null"
  },
  "site-interactions": {
    "invoke": true
  },
  "public-gallery-images": {
    "invoke": true
  }
}
```

`site-interactions` 允许公开调用，是为了让未登录访客读取已审核星空。
函数内部只有 `getPublicStars` 允许无身份，其余 action 都先检查真实认证
上下文。若不需要未登录浏览星空，也可以把它收紧为 `auth != null`。

`admin-content` 即使允许所有登录身份调用，也会再次读取 `admins` 集合；
非管理员只能得到 `NOT_ADMIN`，不会触发待审核查询。

## 5. 管理员审核

打开 `/admin-content/` 后：

1. 先通过网站游客入口登录已登记在 `admins` 中的身份。
2. 点击“验证并读取待处理内容”。
3. 页面先调用现有 `admin-guestbook` 的 `ping`。
4. 验证成功后才调用 `admin-content.listContent`。
5. 内容操作只提交短时 `reviewToken` 和目标状态。
6. 云函数重新确认管理员、凭据所属管理员、过期时间和目标当前仍是
   `pending`，然后写入 `reviewedAt`、`reviewedBy`。

内容列表不会返回 UID、数据库文档 ID、fileId、云路径或管理员信息。
图片预览链接只签发给已经验证的管理员，约 10 分钟后过期。

当前后台提供“确认公开、暂不公开、暂时隐藏、恢复展示、永久删除”。删除访客图片时，云函数先删除
云存储文件；只有文件删除成功才删除数据库记录，避免数据库消失但文件
仍遗留。这个动作不可恢复，页面要求管理员连续确认两次。

## 6. 每日三次限制测试

抽签和记忆卡互相独立，分别测试：

1. 使用网站游客身份进入首页。
2. 第 1 次调用应返回 `todayCount: 1`、`remainingCount: 2`。
3. 第 2 次应返回 `2`、`1`。
4. 第 3 次应返回 `3`、`0`，按钮禁用。
5. 第 4 次直接调用应返回 `LIMIT_REACHED`，数据库计数仍为 3。
6. 用同一个 `requestId` 重放一次 draw 请求，应返回原卡片，计数不增加。

日期重置测试建议使用单独测试环境：

1. 确认当天记录的 `date` 是北京时间日期。
2. 在测试数据中准备前一天日期的记录，或跨过北京时间零点。
3. 再次请求时会使用新的 `uid + action + date` 文档 ID，从 0 开始。
4. 不要在生产环境手工改用户真实记录来模拟。

## 7. 隐私与待审核测试

- 普通浏览器不能直接读取 `visitor_stars`、`drift_bottles`、
  `time_capsules` 和 `admin_review_tokens`。
- `getPublicStars` 只返回 `approved`，pending/rejected/hidden 都不出现。
- `drawBottle` 只从 `approved` 中抽取，且不返回自己的纸条或连续返回
  同一只瓶子。第 4 次请求由服务端返回 `LIMIT_REACHED`。
- 未登录或非管理员调用 `admin-content.listPending` 分别得到
  `NOT_LOGGED_IN`、`NOT_ADMIN`。
- 时光胶囊未到时间时 `openCapsule` 只返回 `LOCKED`，不返回正文。
- 清除浏览器数据或退出后会产生/使用不同匿名 UID；新身份的
  `getMyCapsules` 返回自己的列表，不能找回旧身份胶囊。

## 8. 已知边界

- 匿名身份不是跨设备永久账户，清除浏览器数据可能永久失去个人胶囊。
- 审核只提供基础工作流，不替代内容安全服务或人工判断。
- 管理后台删除图片会同步删除云存储文件，动作不可恢复；操作前应确认
  当前预览内容和审核类型。
- 公开星星和漂流瓶仍应由站长确认适合公开后再展示。
- 云函数、集合、索引和调用权限都必须在控制台手动创建或更新；本地构建
  不会自动改变云端配置。
