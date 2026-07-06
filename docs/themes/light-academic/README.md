# 轻量学术版微站主题（light-academic）

> 数据驱动的会议微站生成器基础模块。  
> 模板来源：[智会行 h5.huiyi.com.cn/h5/weizhan/ertong](https://h5.huiyi.com.cn/h5/weizhan/ertong/)（儿童/学术型微站）

## 适用场景
- 学术型会议（医学/科研/教育）
- 不需要花哨动效的"信息密度型"微站
- 单屏全屏背景 + 9 个功能入口的 H5 落地页
- 微信 H5 / 桌面浏览器自适应

## 文件清单
| 文件 | 用途 |
|------|------|
| `demo.html` | 独立可预览 demo（直接浏览器打开即可） |
| `theme.css` | 主题样式（CSS 变量化，可重定制） |
| `theme.js`  | 菜单渲染器（数据驱动） |
| `schema.json` | 生成器输入数据的 JSON Schema（v1） |
| `assets/icons/*.png` | （可选）图标素材，40×40 透明底 |

## 模板对照表（vs 智会行原版）
| 维度 | 智会行原版 | 本模块（轻量学术版） |
|------|----------|-------------------|
| 依赖 | jQuery + Swiper + iScroll（共 ~120KB） | 0 第三方依赖 |
| HTML | XHTML 1.0 + 内联 style | HTML5 + 语义化 class |
| 菜单布局 | Swiper 横滑轮播 | CSS Grid 3×N（响应式） |
| 数据驱动 | 硬编码 9 个 `<a>` | `LATheme.render(LA_DATA)` 一次渲染 |
| 高度/桌面 | 写死 1920px | `vh` + media query 自适应 |
| 加载资源 | 9 个 PNG 图标 + 背景 JPG | emoji 兜底，可选 PNG 覆盖 |

## 最小用法（独立预览）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <link rel="stylesheet" href="theme.css">
</head>
<body class="theme-la">
  <div class="la-bg"></div>
  <div class="la-top">
    <img id="laLogo">
    <h1 id="laTitle"></h1>
    <p id="laSub"></p>
  </div>
  <div class="la-mask"></div>
  <nav class="la-grid" id="laGrid"></nav>
  <footer class="la-foot" id="laFoot"></footer>
  <script src="theme.js"></script>
</body>
</html>
```

```js
window.LA_DATA = {
  title: "2026 临床遗传学进展论坛",
  sub:   "中国·上海  ·  2026年12月14-15日",
  logo:  "logo.png",
  bg:    "bg.jpg",
  foot:  "© 会议信息管理系统",
  menu: [
    { id:"welcome",  label:"欢迎辞",   icon:"👋", href:"#welcome" },
    { id:"agenda",   label:"会议日程", icon:"📅", href:"#agenda" },
    { id:"reg",      label:"会议报名", icon:"✍️", href:"#reg", primary:true },
    /* ... */
  ]
};
```

## 与 v1.2 微站生成器整合

`ConfStore` 抽象层新增 `theme` 字段即可复用：

```js
// data.js
KEYS.theme = 'conf_theme';
API.getTheme = () => adapter.get(KEYS.theme) || 'default';
API.setTheme = (name) => { adapter.set(KEYS.theme, name); };

// 后台「主题管理」tab 下拉选项
['default', 'light-academic', /* ... */]
```

生成器根据 `meta.theme === 'light-academic'` 加载 `docs/themes/light-academic/{theme.css,theme.js}`。

## 验收
- [x] 9 宫格菜单可点击（`<a href>`）
- [x] 顶部 logo/标题/副标题与背景图可配置
- [x] emoji 兜底（无外部资源也能渲染）
- [x] 移动端 ≤ 760px / 桌面 ≥ 1024px 自适应
- [x] 0 第三方依赖
- [x] `node --check` 校验 JS 语法

## 下一步
- 抽 3~4 套主题（`default` / `light-academic` / `tech-dark` / `warm-corporate`）
- 后台「主题管理」让主办方一键切换
- 图标素材用 CDN 化 emoji + 自定义 PNG 覆盖
