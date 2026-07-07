/* ============================================================
 * 轻量学术版微站 · theme.js
 * ------------------------------------------------------------
 * 数据驱动的 9 宫格渲染器：
 *   - 读 window.LA_DATA（页面脚本注入或 inline JSON）
 *   - 调用 LATheme.render() 把数据渲染到 #laGrid
 *   - 调用 LATheme.applyMeta() 把标题/副标题/Logo/背景图同步到 DOM
 *   - 内置 emoji ↔ PNG 兜底（避免依赖外部资源）
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 默认数据（参考智会行 ertong 模板的 9 个标准模块 + v2.10.10 扩到 13） ---------- */
  var DEFAULT_MENU = [
    { id: 'welcome',  label: '欢迎辞',   icon: '👋', href: '#welcome' },
    { id: 'org',      label: '组织架构', icon: '🏛️', href: '#org' },
    { id: 'info',     label: '会议信息', icon: '📌', href: '#info' },
    { id: 'agenda',   label: '会议日程', icon: '📅', href: '#agenda' },
    { id: 'speakers', label: '嘉宾介绍', icon: '🌟', href: '#speakers' },
    { id: 'reg',      label: '会议报名', icon: '✍️', href: 'javascript:openReg()', primary: true },
    { id: 'seat',     label: '座位查询', icon: '💺', href: 'javascript:openSeat()' },
    { id: 'me',       label: '我的参会', icon: '👤', href: 'javascript:openMe()' },
    { id: 'live',     label: '会议直播', icon: '🎥', href: '#live' },
    { id: 'hotel',    label: '预定酒店', icon: '🏨', href: '#hotel' },
    { id: 'contact',  label: '联系我们', icon: '☎️', href: '#contact' },
    { id: 'invite',   label: '邀请函',   icon: '✉️', href: 'javascript:openInvite()' },
    { id: 'materials',label: '会议资料', icon: '📚', href: '#materials' }
  ];

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'style') n.setAttribute('style', attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function renderItem(item) {
    // v2.10.5：空占位（不足 9 个模块时用半透明空格子补齐）
    if (item.empty) {
      var e = el('div', { class: 'empty-slot', 'aria-hidden': 'true' });
      return e;
    }
    var a = el('a', { href: item.href || '#', 'data-id': item.id });
    var ico = el('p', { class: 'ico' });
    if (item.iconUrl) ico.appendChild(el('img', { src: item.iconUrl, alt: item.label }));
    else ico.textContent = item.icon || '•';
    a.appendChild(ico);
    var titleEl = el('p', { class: 'title' }, [item.label]);
    a.appendChild(titleEl);
    // v2.10.14：浅色主题下主推模块用蓝紫渐变卡 + 白字，保证可读性
    if (item.primary) {
      a.style.background = 'linear-gradient(135deg, #2f54eb, #722ed1)';
      a.style.color = '#fff';
      titleEl.style.color = '#fff';
    }
    return a;
  }

  var api = {
    /* 渲染菜单到 #laGrid（v2.10.10：不传 menu 时不动 DOM，保护外部渲染） */
    render: function (data) {
      var root = document.getElementById('laGrid');
      if (!root) return;
      var menu = (data && data.menu);
      // v2.10.10：没传 menu 不渲染（避免 DEFAULT_MENU 覆盖外部传入的数据）
      if (!menu) return;
      root.innerHTML = '';
      menu.forEach(function (m) { root.appendChild(renderItem(m)); });
    },
    /* 把 data 里的 meta 应用到 #laTitle/#laSub/#laLogo/#laBg
     * v2.10.10：不传 data 不动 DOM（保护外部已设置内容） */
    applyMeta: function (data) {
      if (!data) return;
      if (data.title) { var t = document.getElementById('laTitle'); if (t) t.textContent = data.title; document.title = data.title; }
      if (data.sub)   { var s = document.getElementById('laSub');   if (s) s.textContent = data.sub; }
      if (data.logo)  {
        var l = document.getElementById('laLogo');
        if (l) { try { l.src = data.logo; } catch (e) {} l.setAttribute('src', data.logo); }
      }
      if (data.bg)    { var b = document.getElementById('laBg');    if (b) b.style.backgroundImage = "url('" + data.bg + "')"; }
      if (data.foot)  { var f = document.getElementById('laFoot');  if (f) f.textContent = data.foot; }
    },
    /* 一次性入口（v2.10.10：仅当 data 完整时才挂载） */
    mount: function (data) {
      if (!data) return;
      api.applyMeta(data);
      api.render(data);
    },
    /* 暴露默认菜单供生成器参考 */
    DEFAULT_MENU: DEFAULT_MENU
  };

  global.LATheme = api;

  /* v2.10.10：移除自动 mount
   * 旧逻辑：DOMContentLoaded 时用 window.LA_DATA 自动渲染
   * 问题：如果 LA_DATA 是空或没设置，会用 DEFAULT_MENU（9 个）覆盖外部已渲染的 13 个
   * 现在：由 index-la.html 自己的 IIFE 显式控制渲染时机和数据 */
  // document.addEventListener('DOMContentLoaded', function () {
  //   api.mount(global.LA_DATA || null);
  // });
})(window);
