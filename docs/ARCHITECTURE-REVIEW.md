# 会议信息管理系统 — 技术栈与架构评估（生产级 / 1000 并发）

> 编制时间：2026-07-06
> 编制人：WorkBuddy
> 评估依据：`docs/NEXT-DEV-REQUIREMENTS.md`（P0~P3 完整需求）
> 现状：v1 纯前端（HTML+CSS+JS + localStorage），GitHub：`https://github.com/dawncopper/MeettingMan`
> 目标：**1000 人同时在线**，可上生产，支持 1~3 场会议/月的中小型机构使用

---

## 0. 写在前面：先把目标量化

"1000 人同时访问"在会议系统里的真实画像：

| 场景 | 1000 人的行为 | 系统要扛的负载 |
|------|--------------|---------------|
| **开会议程前 30 分钟** | 1000 人同时打开微站看议程、找座位 | 1000 并发读（峰值 QPS ~3000） |
| **会议报名开放瞬时** | 1000 人同时提交报名 | 1000 并发写（写 QPS 峰值 ~200） |
| **签到开门 5 分钟** | 1000 人扫码签到 | 1000 并发写 + 实时查询（峰值 QPS ~500） |
| **座位查询 / 邀请函** | 1000 人翻座位、生成海报 | 读为主 + 偶发写 |
| **抽奖大屏 + 个人中心** | 1000 人同时刷中奖名单 | 读密集 + SSE 推送 |

> 关键洞察：1000 并发**不是洪水**，是**单台 2C4G 都能扛**的量级。真正难的是**写一致性**（抢票、抢座不能超卖）、**实时性**（抽奖名单、签到墙）和**抗羊毛**（恶意刷报名）。

下面这套架构专门为这个量级设计。

---

## 1. 现状（v1）能扛多少？

| 维度 | 现状 | 上限 |
|------|------|------|
| 数据存储 | 浏览器 `localStorage` | **单机单用户**，0 并发共享能力 |
| 服务端 | 无 | N/A |
| 部署 | GitHub Pages / `python -m http.server` | 静态文件分发 |
| 真实并发 | 0（每个浏览器独立） | 0 |
| 一致性 | 无 | 无 |
| 适用场景 | 单机演示、UI 展示、提案 PPT | **不能上生产** |

> 结论：v1 是 **UI 原型**，不是**产品**。要从 v1 走到生产，必须引入 **BFF + 数据库 + 缓存 + 对象存储** 这四件套。

---

## 2. 目标架构 v2 — 最小可生产架构

### 2.1 一张图

```
                          ┌─────────────────────────────┐
                          │   微信 / H5 / PC 浏览器      │
                          │   (1000 用户, 移动 70%/PC 30%)│
                          └──────────┬──────────────────┘
                                     │ HTTPS
                          ┌──────────▼──────────────────┐
                          │   阿里云 / 腾讯云  CDN + WAF │
                          │   (静态资源 + 防 CC / 防刷)   │
                          └──────────┬──────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
   ┌──────────▼────────┐  ┌──────────▼────────┐  ┌──────────▼────────┐
   │ 微站 (H5 / PWA)    │  │ 后台 (Admin SPA)  │  │ 签到大屏 / 互动   │
   │  静态 + BFF 调用   │  │  Vue3 + Element+ │  │  WebSocket/SSE     │
   └──────────┬─────────┘  └──────────┬─────────┘  └──────────┬─────────┘
              │                       │                       │
              └──────────┬────────────┴───────────┬──────────┘
                         │ HTTPS/WSS               │
                ┌────────▼─────────┐      ┌────────▼────────┐
                │  Nginx  (反向代理)│      │  WSS 推送服务    │
                │  + 限流 + SSL     │      │  (Node/SSE)      │
                └────────┬─────────┘      └────────┬────────┘
                         │                        │
                ┌────────▼─────────────────────────▼────────┐
                │        BFF 层 (Backend-For-Frontend)       │
                │  Node.js 20 + NestJS / Fastify              │
                │  - 鉴权 / 签名                              │
                │  - 业务聚合 (1 个 H5 屏 ≤ 3 个 RPC)         │
                │  - 限流 / 防刷 / 验证码                     │
                │  - 微信 JS-SDK 签名                         │
                └────┬──────────┬──────────┬──────────┬──────┘
                     │          │          │          │
         ┌───────────▼─┐ ┌──────▼────┐ ┌───▼────┐ ┌──▼──────────┐
         │ PostgreSQL │ │ Redis     │ │  搜索  │ │ 对象存储 OSS │
         │ 16 (主从)  │ │ 7 (主从)  │ │ Meili- │ │ 阿里云 OSS   │
         │ 行级锁     │ │ 缓存/锁  │ │ search │ │ (资料/海报)  │
         │ + WAL 流  │ │ + 限流  │ │ /ES   │ │              │
         └────────────┘ └──────────┘ └────────┘ └──────────────┘
```

### 2.2 选型矩阵

| 层 | 选型 | 理由 | 备选 |
|----|------|------|------|
| **微站前端** | Vue 3 + Vite + Vant 4 | 移动端组件库成熟，包小；Vue3 性能优于 Vue2；HBuilderX 也能用 | React + Ant Design Mobile |
| **后台前端** | Vue 3 + Element Plus | 表格/表单/树形最强 | React + Ant Design Pro |
| **构建工具** | Vite 5 | 启动 <1s，原生 ESM | Webpack 5（老项目） |
| **包管理** | pnpm | 节省磁盘，monorepo 友好 | npm / yarn |
| **类型系统** | TypeScript 5 | BFF 强类型，减少运行时错误 | JS + JSDoc |
| **BFF 框架** | NestJS 10 | 模块化、DI、装饰器、Swagger 自带；适合中型团队 | Fastify（更轻）、Egg.js（阿里系） |
| **运行时** | Node.js 20 LTS | LTS 长期支持 | Bun（实验性）、Deno |
| **关系数据库** | PostgreSQL 16 | 行级锁、JSONB、CTE 强；事务满足抢票抢座 | MySQL 8（团队熟） |
| **缓存** | Redis 7 | 限流、分布式锁、缓存、签到墙 Pub/Sub | KeyDB / Dragonfly |
| **搜索** | Meilisearch | 议程/嘉宾全文搜索，1 核 2G 就能跑 | Elasticsearch（重） |
| **对象存储** | 阿里云 OSS / 腾讯云 COS | 邀请函海报、嘉宾头像、PDF 手册 | AWS S3（海外） |
| **CDN** | 阿里云 CDN / 腾讯云 CDN | 静态资源分发 + 边缘缓存 | Cloudflare |
| **反向代理** | Nginx 1.24 | 限流、gzip、SSL 卸载 | OpenResty（带 lua） |
| **进程管理** | PM2 / systemd | 守护进程、日志、负载均衡 | Docker + K8s（v3 用） |
| **监控** | Prometheus + Grafana | 业务指标可视化 | 云监控（更省心） |
| **日志** | Loki / ELK | 集中日志 | 简单方案：本地 log + 阿里云 SLS |
| **CI/CD** | GitHub Actions | 推送即构建 | GitLab CI |
| **部署** | 阿里云 ECS 2C4G × 2 台 | 1000 并发绑绑有余 | Docker Compose 起步，K8s 后续 |

### 2.3 关键组件成本与性能估算（1000 并发）

| 资源 | 规格 | 月成本（¥） | 用途 |
|------|------|------------|------|
| ECS × 2 | 2C4G / 5Mbps | 400 | BFF + WS |
| RDS PostgreSQL | 1C2G / 20GB | 200 | 主库（只读分离后 +200） |
| Redis | 1G 标准版 | 100 | 缓存 + 锁 |
| OSS | 100GB / 10TB 流量 | 50 | 海报 / 资料 |
| CDN | 100GB 流量 | 50 | 静态资源 |
| 域名 + SSL | - | 50 | - |
| 监控 / 日志 | - | 50 | - |
| **合计** | - | **~900 元/月** | 1000 并发绑绑有余 |

> 这个成本对比智会行这类 SaaS（年费 5~20 万）相当于 **0.05%**，自建 v2 完全划算。

### 2.4 性能指标（SLI / SLO）

| 指标 | 目标 | 监控方式 |
|------|------|---------|
| 首屏 FCP | < 1.5s（4G） | Web Vitals SDK |
| API p95 延迟 | < 300ms | Prometheus + Grafana |
| API 错误率 | < 0.1% | 日志告警 |
| 报名接口 QPS | 200（峰值） | 压测 |
| 座位分配冲突 | 0 | 行级锁 + 单测 |
| 抽奖名单延迟 | < 1s | SSE |
| 数据库 QPS | < 1000 | pg_stat |
| Redis 命中率 | > 85% | redis-cli info |

---

## 3. 架构核心问题逐项解答

### 3.1 抢座 / 抢票怎么保证不超卖？

**方案：PostgreSQL 事务 + 唯一约束 + 乐观锁**

```sql
-- 座位表
CREATE TABLE seats (
  id BIGSERIAL PRIMARY KEY,
  zone CHAR(1) NOT NULL,        -- A/B/C
  row_no INT NOT NULL,
  col_no INT NOT NULL,
  status SMALLINT DEFAULT 0,    -- 0=空 1=已占 2=留座
  reg_id BIGINT,
  UNIQUE(zone, row_no, col_no)  -- 物理唯一
);
CREATE UNIQUE INDEX uniq_reg ON regs(conf_id, name, phone);

-- 抢座流程（BFF 中）
BEGIN;
  -- 1. 找空位（行级锁）
  SELECT id FROM seats
   WHERE conf_id=$1 AND status=0
   ORDER BY zone, row_no, col_no
   LIMIT 1
   FOR UPDATE SKIP LOCKED;        -- 跳过已被别人锁的行

  -- 2. 写报名
  INSERT INTO regs(...) VALUES (...) RETURNING id;

  -- 3. 占用座位
  UPDATE seats SET status=1, reg_id=$2 WHERE id=$3;
COMMIT;
```

`FOR UPDATE SKIP LOCKED` 是 PostgreSQL 的杀手锏 — 1000 人并发抢座不会阻塞，最后失败的请求拿到 `null` 后友好提示"座位已满"。

**Redis 分布式锁（兜底）**：
```js
// 同一姓名+手机 5s 内只允许 1 个报名请求
const lockKey = `reg_lock:${confId}:${name}:${phone}`;
const ok = await redis.set(lockKey, '1', 'EX', 5, 'NX');
if (!ok) return { code: 429, msg: '请勿重复提交' };
```

### 3.2 1000 人同时刷座位图怎么办？

**方案：座位图只读 + 预渲染 + 浏览器侧聚合**

- 座位表查询走 Redis 缓存：`seats:{confId}` 整体缓存，TTL 60s
- 改座 / 报名 → 双写 Redis + 失效缓存
- 用户查询 → BFF 查 Redis 命中后直返（< 5ms）
- 座位图渲染：前端只渲染"有 / 无"，姓名+手机号查询走另一个接口，限流 60 req/min/IP

### 3.3 实时签到墙 / 抽奖怎么推送？

**方案：SSE（Server-Sent Events）** — 1000 并发足够，比 WebSocket 简单

```ts
// NestJS Controller
@Sse('sse/checkin/:confId')
checkinStream(@Param('confId') id: string): Observable<MessageEvent> {
  return fromEvent(this.checkinBus, `checkin:${id}`).pipe(
    map((reg) => ({ data: reg }))
  );
}

// 签到接口
@Post('checkin')
async checkin(@Body() dto) {
  // ...写库...
  this.checkinBus.emit(`checkin:${dto.confId}`, reg);
  return { ok: true };
}
```

- Nginx 需 `proxy_buffering off; proxy_read_timeout 3600s;`
- 浏览器用 `EventSource` 自动重连

> 微信 H5 不支持 EventSource 长连接的兜底：**5s 轮询**（v1 风格就能用）

### 3.4 静态资源怎么分发？

- HTML/JS/CSS/字体 → CDN + 强缓存（1y）+ 文件名 hash
- 图片 → CDN + WebP/AVIF + responsive（200/400/800/1200）
- 海报 / 资料 PDF → OSS + CDN + 签名 URL（防盗链）

### 3.5 微信生态兼容

- 微站 H5 + JS-SDK 签名由 BFF 签发
- 微信支付：后端统一下单 → H5 调起支付 SDK
- 公众号菜单：主办方自己配，URL 指向微站
- 分享卡片：JS-SDK `updateAppMessageShareData`，标题/图/desc 由后端模板渲染

### 3.6 抗羊毛 / 抗刷

- **报名接口限流**：1 IP 60 req/min，1 用户 5 req/min（Redis 滑动窗口）
- **图形验证码**：极验 / 腾讯防水墙
- **手机号短信验证**：阿里云短信，1 个号 1 分钟内只能收 1 条
- **座位查询限流**：1 IP 30 req/min
- **WAF 规则**：阿里云 WAF 自带 CC 防护

### 3.7 数据迁移（v1 → v2）

| 现状 | 目标 |
|------|------|
| `localStorage` 5 个 KEY | PostgreSQL 多张表（conf/speakers/agenda/regs/seats/materials + 新增表） |
| 种子数据 | 一次性 SQL 脚本导入 |
| 后台 CRUD | BFF API + 同一份 admin 前端 |
| 唯一差异 | 旧数据存浏览器、新数据存服务器；迁移时给主办方提供"导入旧 localStorage 数据"按钮 |

---

## 4. 推荐的演进路线（4 步走）

### Step 1 — v1.5：BFF 化（1 周，**0 成本**）
保留前端 + localStorage，**只新增一个 BFF 写日志**。
- 任何报名 / 座位请求先 POST 到 BFF，BFF 落库 + 异步写 localStorage
- 价值：拿到真实数据，验证 BFF 架构
- 风险：0

### Step 2 — v2.0：后端 + 数据库（3 周，**~1000 元/月**）
- 部署 NestJS + PostgreSQL + Redis（云上托管）
- 重写 4 个核心 API：报名 / 座位分配 / 嘉宾管理 / 议程管理
- 前端从 localStorage 切换为 API 调用（`ConfStore` 抽象层先于 v1 引入，**这一步是核心**）
- 部署 P0-1（团队报名）+ P0-2（个人中心）+ P0-3（邀请函）

### Step 3 — v2.5：实时 + 互动（2 周，**+300 元/月**）
- 加 SSE 推送
- 加 WebSocket 大屏互动
- 部署 P1-4（签到墙）+ P2-1（抽奖大屏）+ P2-10（地图点亮）

### Step 4 — v3.0：多租户 SaaS（季度级）
- 多会议 / 多机构
- RBAC 权限
- 数据看板
- 第三方对接（微信支付 / 直播平台）
- 部署 P3 全套

---

## 5. 当前架构图（v1 状态）

```
┌──────────────────────────────────┐
│  1000 浏览器各自独立的 localStorage │ ← 0 共享
│  互相之间看不到对方               │
└──────────────────────────────────┘
          ↓
┌──────────────────────────────────┐
│  GitHub Pages 静态托管            │ ← 只发 HTML
│  没有服务端、没有数据库、没有缓存  │
└──────────────────────────────────┘
```

## 6. 目标架构图（v2 状态）

```
1000 浏览器 ──HTTPS── CDN ──Nginx── NestJS BFF
                                       │
                          ┌────────────┼────────────┐
                          │            │            │
                       PostgreSQL    Redis       OSS+CDN
                       (数据真相)   (缓存/锁)   (海报/资料)
                                       │
                                  SSE/WS 推送
                                       │
                              签到墙/抽奖大屏
```

## 7. 关键决策（需用户确认）

| 决策点 | 选项 | 推荐 | 影响 |
|--------|------|------|------|
| **后端语言** | Node.js (NestJS) / Go (Gin) / Python (FastAPI) | **Node.js** | 团队复用 TS 技能 |
| **数据库** | PostgreSQL / MySQL | **PostgreSQL** | 抢座/抢票场景强 |
| **前端框架** | Vue 3 / React 18 | **Vue 3** | Vant 移动端成熟 |
| **部署形态** | 物理机 / Docker / K8s | **Docker Compose 起步** | 1000 并发不需要 K8s |
| **是否引入微前端** | qiankun / wujie / 不引入 | **不引入** | 单仓单应用足矣 |
| **是否上 TypeScript** | 是 / 否 | **是** | BFF 必上 |
| **是否引入 GraphQL** | 是 / 否 | **否** | REST + BFF 聚合更简单 |
| **是否引入 ORM** | Prisma / TypeORM / 写裸 SQL | **Prisma** | 类型安全，迁移友好 |
| **实时方案** | SSE / WebSocket / 轮询 | **SSE + 轮询兜底** | 微信兼容 |
| **CI/CD** | GitHub Actions / Jenkins | **GitHub Actions** | 仓库在 GitHub 顺手用 |

---

## 8. 反模式清单（不要做的事）

| ❌ 不要做 | ✅ 替代 |
|----------|--------|
| 把数据继续存 localStorage | 必须上 PostgreSQL |
| 用 MongoDB 存关系数据 | 用 PostgreSQL |
| 微服务起步 | 单体 BFF 起步，1000 并发不需要微服务 |
| 引入 K8s | 2 台 ECS + Docker Compose 足矣 |
| 上 GraphQL | REST + BFF 聚合 |
| 全部用 WebSocket | SSE 更简单，WebSocket 只在需要双向时才用 |
| 自研视频流 | 嵌入第三方直播平台 iframe |
| 自己做支付网关 | 微信支付 / 支付宝官方 SDK |
| 客户端存敏感信息（手机号 / 身份证） | 后端落库，前端只取脱敏数据 |
| 不做备份就上生产 | RDS 自动备份 + 每日手动 dump 到 OSS |

---

## 9. 验收标准

v2 上线门槛（必须全部达成）：

- [ ] 1000 并发报名：50% 转化场景下 0 超卖
- [ ] API p95 延迟 < 300ms
- [ ] 静态首屏 < 1.5s（4G）
- [ ] 数据库 RPO < 5min，RTO < 30min
- [ ] 关键 API 有单元测试 + 集成测试
- [ ] Swagger / OpenAPI 文档自动生成
- [ ] 监控面板覆盖 4 个黄金指标（流量/错误/延迟/饱和度）
- [ ] 故障演练：拔掉一台 ECS，业务不中断

---

## 10. 一句话总结

> 1000 并发**不难**，**难的是写一致性和实时性**。本架构用 **NestJS + PostgreSQL + Redis + SSE** 这套经典组合就能完美胜任，**月成本不到 1000 元**，3 周可上线生产。

---

**附录 A：参考架构**
- 友商：智会行 / 智会智展 / 31 会议 / 米课云会议（均 SaaS 化）
- 开源参考：[NocoBase](https://github.com/nocobase/nocobase) / [NocoDB](https://github.com/nocodb/nocodb) / [Saleor](https://github.com/saleor/saleor)

**附录 B：核心依赖版本（v2 起步）**

```json
{
  "engines": { "node": ">=20.11.0" },
  "dependencies": {
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "@prisma/client": "^5.10.0",
    "ioredis": "^5.3.2",
    "zod": "^3.22.4",
    "dayjs": "^1.11.10",
    "jsonwebtoken": "^9.0.2"
  }
}
```

**状态**：草案 v1.0，待评审与决策点确认。
