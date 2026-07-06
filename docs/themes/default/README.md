# 默认版微站主题（default）

> 项目原生 v1 主题：科技蓝大 hero + 倒计时 + 模块化卡片。  
> 完整可运行版本见根目录 `index.html` / `admin.html` / `assets/`。  
> 本目录为「主题可复用」形态的占位与规范说明，便于后续抽离出独立的 default 主题包。

## 适用场景
- 通用型会议（数字经济、产业、科技、政务）
- 需要倒计时 + 议程日切换 + 嘉宾阵容 + 报名 + 座位查询的完整闭环
- 移动端底部 Tab + 桌面端顶部 sticky 导航

## 文件清单
| 文件 | 用途 |
|------|------|
| `schema.json` | JSON Schema v1：生成器输入约束 |
| `README.md`   | 本文件 |

> **注**：当前 `index.html` / `admin.html` / `assets/js/site.js` / `assets/css/style.css` 仍位于项目根目录。  
> 后续若需要把"默认版"也彻底抽离到 `docs/themes/default/`，可参考 light-academic 模式生成：
> - `default.html`（页骨架）
> - `default.css`（样式）
> - `default.js`（渲染器）
> - 并把 `ConfStore.listThemes()` 注册的 key 改为指向新目录。

## 关键设计点
- **数据源**：全部来自 `ConfStore`（meta / speakers / agenda / materials / stats）
- **响应式断点**：760px / 960px（移动 → 平板 → 桌面）
- **品牌色**：`--brand: #2f54eb` / `--brand-2: #722ed1` / `--gold: #f0b429`
- **倒计时**：到会议开始日 09:00 实时刷新
- **议程日切换**：点击 Day tab 切换内容
- **座位图**：3 区（A/B/C）共 344 座，报名时自动分配

## 验收
- [x] 移动端底部 Tab 高亮
- [x] 桌面端顶部 sticky 导航
- [x] 倒计时实时刷新
- [x] 议程日切换
- [x] 嘉宾网格（移动 2 列 / 桌面 4 列）
- [x] 报名弹层（个人/团队切换）
- [x] 座位查询 + 座位图高亮
- [x] 个人中心（姓名+手机查询）
- [x] 邀请函海报（Canvas 1080×1920 + 二维码）
- [x] 会前提醒（浏览器通知 + 站内 toast）
- [x] 访问统计（PV/UV 去重 + 转化漏斗）

## 与 light-academic 主题的对照
| 维度 | default | light-academic |
|------|---------|----------------|
| 适用 | 通用型会议 | 学术型 / 信息密度型 |
| 入口 | 滚动浏览多模块 | 9 宫格图标跳转 |
| 品牌色 | 科技蓝渐变 | 跟随背景图 |
| 报名入口 | 底部 Tab + 悬浮按钮 | 宫格第 5 项「会议报名」 |
| 倒计时 | ✅ 有 | ❌ 无 |
| 数据概览 | ✅ 4 项 stat | ❌ 无 |
| 议程展开 | ✅ 直接展示 | ❌ 跳转新页 |
