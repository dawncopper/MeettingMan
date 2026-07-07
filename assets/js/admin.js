/* ============================================================
 * 会议信息管理系统 - 后台管理逻辑 v2
 * 依赖：assets/js/data.js（ConfStore async API）
 * ============================================================ */
(async function () {
  'use strict';
  var S = window.ConfStore;
  await S.init();

  function $(id) { return document.getElementById(id); }
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 1800);
  }
  window.toast = toast;
  window.closeAdmin = function (id) { $(id).classList.remove('show'); };

  /* ---------- Tab 切换 ---------- */
  var tabs = document.querySelectorAll('#adminTabs button');
  tabs.forEach(function (b) {
    b.onclick = function () {
      tabs.forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      document.querySelectorAll('.admin-section').forEach(function (s) { s.classList.remove('active'); });
      $('tab-' + b.getAttribute('data-tab')).classList.add('active');
      if (b.getAttribute('data-tab') === 'stats') renderStats();
      if (b.getAttribute('data-tab') === 'themes') renderThemes();
      if (b.getAttribute('data-tab') === 'modules') renderModules();
    };
  });

  /* 颜色色板（v2.3：基本信息视觉资产用，提前声明避免 hoisting 未初始化） */
  var COLOR_PALETTE = ['#2f54eb', '#722ed1', '#13c2c2', '#52c41a', '#fa8c16', '#eb2f96', '#f0b429', '#14182b', '#4a5070'];

  /* ---------- 基本信息（v2.4：只读元数据 + 易变字段 + 主题下拉） ---------- */
  var STATUS_MAP = { draft: '草稿', open: '报名中', ongoing: '进行中', closed: '已结束' };
  var LANG_MAP   = { 'zh-CN': '简体中文', 'zh-TW': '繁體中文', 'en': 'English' };

  /* 顶部只读区：会议元数据（名称/slug/状态/语言/简介/URL）—— 在「会议管理」编辑 */
  async function paintMetaReadonly() {
    var m = await S.getCurrentMeeting();
    if (!m) {
      ['mr_name', 'mr_slug', 'mr_status', 'mr_lang', 'mr_summary'].forEach(function (id) { $(id).textContent = '—'; });
      $('mr_url').textContent = '—';
      return;
    }
    $('mr_name').textContent = m.name || '—';
    $('mr_slug').textContent = m.slug || '—';
    $('mr_status').textContent = STATUS_MAP[m.status] || m.status || '—';
    $('mr_lang').textContent = LANG_MAP[m.lang] || m.lang || '—';
    $('mr_summary').textContent = m.summary || '—';
    var url = await S.getMeetingUrl(m.slug);
    $('mr_url').textContent = url || '—';
    $('mr_url').setAttribute('data-url', url || '');
    var btn = $('mr_url_copy');
    if (btn) btn.onclick = function () { copyUrl(url); };
  }
  await paintMetaReadonly();

  /* 主题下拉：把 THEMES 渲染到 #themeSelect */
  async function paintThemeSelect() {
    var themes = await S.listThemes();
    var current = await S.getTheme();
    var sel = $('themeSelect');
    if (!sel) return;
    // 按 group 分组显示
    var groups = {};
    themes.forEach(function (t) {
      (groups[t.group] = groups[t.group] || []).push(t);
    });
    sel.innerHTML = Object.keys(groups).map(function (g) {
      return '<optgroup label="' + g + '">' +
        groups[g].map(function (t) {
          return '<option value="' + t.key + '"' + (t.key === current ? ' selected' : '') + '>' +
            (t.emoji || '🎨') + ' ' + t.name + '（' + t.key + '）</option>';
        }).join('') + '</optgroup>';
    }).join('');
  }
  await paintThemeSelect();

  async function loadMetaForm() {
    var meta = await S.getMeta();
    var mf = $('metaForm');
    // v2.4：title 不在表单里（移到会议管理），保留 enTitle/date/endDate/city/venue/address/about
    ['enTitle', 'date', 'endDate', 'city', 'venue', 'address', 'about'].forEach(function (k) {
      if (mf.elements[k]) mf.elements[k].value = meta[k] || '';
    });
    // v2.4：用 elements[...] 避免与 form 内置属性碰撞
    if (mf.elements['phone'])     mf.elements['phone'].value     = (meta.contact && meta.contact.phone) || '';
    if (mf.elements['email'])     mf.elements['email'].value     = (meta.contact && meta.contact.email) || '';
    if (mf.elements['wechat'])    mf.elements['wechat'].value    = (meta.contact && meta.contact.wechat) || '';
    if (mf.elements['highlights'])mf.elements['highlights'].value= (meta.highlights || []).join('，');
    if (mf.elements['logo'])      mf.elements['logo'].value      = meta.logo || '';
    if (mf.elements['bgImage'])   mf.elements['bgImage'].value   = meta.bgImage || '';
    if (mf.elements['bgColor'])   mf.elements['bgColor'].value   = meta.bgColor || '#2f54eb';
    if (mf.elements['bgColorText'])mf.elements['bgColorText'].value = meta.bgColor || '#2f54eb';
    paintLogoPreview(); paintBgPreview(); paintColorSwatches();
  }
  await loadMetaForm();

  function paintLogoPreview() {
    var src = $('metaForm').elements['logo'].value.trim();
    $('logoPreview').innerHTML = src ? '<img src="' + src + '" alt="logo">' : '<i>未设置</i>';
  }
  function paintBgPreview() {
    var src = $('metaForm').elements['bgImage'].value.trim();
    $('bgPreview').innerHTML = src ? '<img src="' + src + '" alt="bg">' : '<i>未设置</i>';
  }
  /* 颜色色板 + 联动 */
  function paintColorSwatches() {
    $('colorSwatches').innerHTML = COLOR_PALETTE.map(function (c) {
      return '<span class="swatch" style="background:' + c + '" data-c="' + c + '"></span>';
    }).join('');
    [].forEach.call($('colorSwatches').querySelectorAll('.swatch'), function (s) {
      s.onclick = function () {
        var c = s.getAttribute('data-c');
        $('metaForm').elements['bgColor'].value = c;
        $('metaForm').elements['bgColorText'].value = c;
      };
    });
  }
  $('metaForm').elements['bgColor'].oninput = function () { $('metaForm').elements['bgColorText'].value = $('metaForm').elements['bgColor'].value; };
  $('metaForm').elements['bgColorText'].oninput = function () {
    var v = $('metaForm').elements['bgColorText'].value.trim();
    if (/^#([0-9a-f]{6})$/i.test(v)) $('metaForm').elements['bgColor'].value = v;
  };
  $('metaForm').elements['logo'].oninput = paintLogoPreview;
  $('metaForm').elements['bgImage'].oninput = paintBgPreview;
  /* 文件转 base64 */
  function bindFileToInput(fileInp, targetInp, previewFn) {
    if (!fileInp) return;
    fileInp.onchange = function () {
      var f = fileInp.files && fileInp.files[0];
      if (!f) return;
      if (f.size > 800 * 1024) { toast('图片超过 800KB，请压缩后再试'); return; }
      var r = new FileReader();
      r.onload = function () {
        targetInp.value = r.result;
        if (previewFn) previewFn();
        toast('已加载（base64）');
      };
      r.readAsDataURL(f);
    };
  }
  bindFileToInput($('metaForm').elements['logoFile'], $('metaForm').elements['logo'], paintLogoPreview);
  bindFileToInput($('metaForm').elements['bgFile'],  $('metaForm').elements['bgImage'], paintBgPreview);
  /* 嘉宾照片上传 + 预览 + 清除 */
  function paintSpPhotoPreview() {
    var src = $('spForm').elements['photo'].value.trim();
    var p = $('spPhotoPrev');
    if (src) { p.src = src; p.style.display = 'block'; } else { p.removeAttribute('src'); p.style.display = 'none'; }
  }
  bindFileToInput($('spForm').elements['photoFile'], $('spForm').elements['photo'], paintSpPhotoPreview);
  $('spForm').elements['photo'].oninput = paintSpPhotoPreview;
  window.clearSpPhoto = function () {
    var f = $('spForm');
    f.elements['photo'].value = '';
    if (f.elements['photoFile']) f.elements['photoFile'].value = '';
    paintSpPhotoPreview();
  };

  $('metaForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var mf = e.target;
    var v = {};
    // v2.4：表单不再含 title（会议管理专属），主题改用下拉
    ['enTitle', 'date', 'endDate', 'city', 'venue', 'address', 'about'].forEach(function (k) {
      if (mf.elements[k]) v[k] = mf.elements[k].value.trim();
    });
    v.contact = {
      phone:  mf.elements['phone'].value.trim(),
      email:  mf.elements['email'].value.trim(),
      wechat: mf.elements['wechat'].value.trim()
    };
    v.highlights = mf.elements['highlights'].value.split(/[，,]/).map(function (s) { return s.trim(); }).filter(Boolean);
    v.logo    = mf.elements['logo'].value.trim();
    v.bgImage = mf.elements['bgImage'].value.trim();
    v.bgColor = mf.elements['bgColorText'].value.trim() || mf.elements['bgColor'].value;
    // 兼容旧字段：保留 shortTitle/slogan/liveUrl（其它地方可能用到）
    var curMeta = await S.getMeta();
    v.shortTitle = curMeta.shortTitle || (v.enTitle ? v.enTitle.split(' ')[0] : '');
    v.slogan = curMeta.slogan || '';
    v.liveUrl = curMeta.liveUrl || '';
    await S.setMeta(v);
    // 主题单独走会议 theme 字段（不再写 meta.theme）
    var themeKey = $('themeSelect').value;
    if (themeKey) await S.setTheme(themeKey);
    toast('基本信息已保存');
  });

  /* ---------- 嘉宾管理 ---------- */
  async function renderSpeakers() {
    var body = $('speakerBody'); body.innerHTML = '';
    var list = await S.getSpeakers();
    list.forEach(function (sp) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + sp.name + '</td><td>' + sp.title + '</td><td>' + sp.org + '</td><td>' + (sp.topic || '') +
        '</td><td><span class="op" onclick="editSpeaker(\'' + sp.id + '\')">编辑</span><span class="op del" onclick="delSpeaker(\'' + sp.id + '\')">删除</span></td>';
      body.appendChild(tr);
    });
  }
  window.editSpeaker = async function (id) {
    var list = await S.getSpeakers();
    var sp = id ? list.filter(function (x) { return x.id === id; })[0] : null;
    $('spTitle').textContent = sp ? '编辑嘉宾' : '新增嘉宾';
    var f = $('spForm');
    f.elements['id'].value = sp ? sp.id : '';
    f.elements['name'].value = sp ? sp.name : '';
    f.elements['title'].value = sp ? sp.title : '';
    f.org.value = sp ? sp.org : '';
    f.topic.value = sp ? sp.topic : '';
    f.photo.value = sp ? sp.photo : '';
    f.color.value = sp ? sp.color : '#2f54eb';
    paintSpPhotoPreview();
    $('spMask').classList.add('show');
  };
  window.delSpeaker = async function (id) {
    if (!confirm('确认删除该嘉宾？')) return;
    var list = await S.getSpeakers();
    await S.setSpeakers(list.filter(function (x) { return x.id !== id; }));
    await renderSpeakers(); toast('已删除');
  };
  $('spForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = e.target;
    var list = await S.getSpeakers();
    var nm = f.elements['name'].value.trim();
    var obj = { id: f.elements['id'].value || S.uid('s'), name: nm, title: f.elements['title'].value.trim(),
      org: f.org.value.trim(), topic: f.topic.value.trim(),
      avatar: nm.slice(0, 1), photo: f.photo.value.trim(),
      color: f.color.value };
    if (f.elements['id'].value) {
      list = list.map(function (x) { return x.id === obj.id ? obj : x; });
    } else { list.push(obj); }
    await S.setSpeakers(list);
    $('spMask').classList.remove('show');
    await renderSpeakers(); toast('已保存');
  });

  /* ---------- 议程管理 ---------- */
  async function renderAgenda() {
    var box = $('agendaAdmin'); box.innerHTML = '';
    var list = await S.getAgenda();
    list.forEach(function (day, di) {
      var card = document.createElement('div');
      card.className = 'card'; card.style.marginBottom = '14px';
      var head = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b>' + day.day + '</b><span><span class="op del" onclick="delDay(' + di + ')">删除当天</span></span></div>';
      var rows = (day.sessions || []).map(function (s, si) {
        return '<div class="item" style="display:flex;gap:10px;padding:8px 0;border-bottom:1px dashed var(--line)">' +
          '<input class="seg-in" data-d="' + di + '" data-s="' + si + '" data-k="time" value="' + s.time + '" style="width:110px;padding:6px 8px;border:1px solid var(--line);border-radius:8px">' +
          '<input data-d="' + di + '" data-s="' + si + '" data-k="title" value="' + s.title + '" style="flex:1;padding:6px 8px;border:1px solid var(--line);border-radius:8px">' +
          '<input data-d="' + di + '" data-s="' + si + '" data-k="speaker" value="' + s.speaker + '" style="width:140px;padding:6px 8px;border:1px solid var(--line);border-radius:8px">' +
          '<span class="op del" onclick="delSession(' + di + ',' + si + ')">✕</span></div>';
      }).join('');
      card.innerHTML = head + rows +
        '<button class="btn ghost sm" style="margin-top:8px" onclick="addSession(' + di + ')">+ 添加议程</button>';
      box.appendChild(card);
    });
    [].forEach.call(box.querySelectorAll('input[data-k]'), function (inp) {
      inp.onchange = async function () {
        var d = +inp.getAttribute('data-d'), s = +inp.getAttribute('data-s'), k = inp.getAttribute('data-k');
        var list = await S.getAgenda();
        list[d].sessions[s][k] = inp.value;
        await S.setAgenda(list);
      };
    });
  }
  window.addDay = async function () {
    var list = await S.getAgenda();
    list.push({ day: 'Day ' + (list.length + 1) + ' · 新日期', date: '', sessions: [] });
    await S.setAgenda(list); await renderAgenda(); toast('已新增日期');
  };
  window.delDay = async function (i) {
    if (!confirm('确认删除当天全部议程？')) return;
    var list = await S.getAgenda(); list.splice(i, 1); await S.setAgenda(list); await renderAgenda();
  };
  window.addSession = async function (i) {
    var list = await S.getAgenda();
    list[i].sessions.push({ time: '09:00-10:00', title: '新议程', speaker: '演讲人', type: 'keynote' });
    await S.setAgenda(list); await renderAgenda();
  };
  window.delSession = async function (di, si) {
    var list = await S.getAgenda(); list[di].sessions.splice(si, 1); await S.setAgenda(list); await renderAgenda();
  };

  /* ---------- 报名管理 ---------- */
  async function renderRegs() {
    var body = $('regBody'); body.innerHTML = '';
    var list = await S.getRegs();
    $('regEmpty').style.display = list.length ? 'none' : 'block';
    list.slice().reverse().forEach(function (r) {
      var tr = document.createElement('tr');
      var team = r.teamId ? ' · 团队' : '';
      tr.innerHTML = '<td>' + r.name + '</td><td>' + r.phone + '</td><td>' + r.org + '</td><td>' + (r.ticket || '-') +
        '</td><td>' + (r.hotel || '-') + '</td><td>' + (r.time || '').slice(0, 16).replace('T', ' ') + team + '</td>' +
        '<td><span class="op del" onclick="delReg(\'' + r.id + '\')">删除</span></td>';
      body.appendChild(tr);
    });
  }
  window.delReg = async function (id) {
    if (!confirm('确认删除该报名？')) return;
    await S.removeReg(id); await renderRegs(); toast('已删除');
  };
  window.exportRegs = async function () {
    var list = await S.getRegs();
    if (!list.length) { toast('暂无数据'); return; }
    var head = ['姓名', '手机', '单位', '职务', '票种', '住宿', '团队', '订单号', '时间'];
    var rows = list.map(function (r) {
      return [r.name, r.phone, r.org, r.title || '', r.ticket || '', r.hotel || '',
        r.teamName || '', r.orderNo || '', r.time || ''];
    });
    var csv = '﻿' + head.join(',') + '\n' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = '报名记录_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
    toast('已导出 ' + list.length + ' 条');
  };
  function csvCell(v) { v = (v == null ? '' : String(v)); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

  /* ---------- 座位管理 ---------- */
  async function renderSeats() {
    var body = $('seatBody'); body.innerHTML = '';
    var seats = await S.getSeats();
    var arr = Object.keys(seats).map(function (k) { return seats[k]; });
    $('seatEmpty').style.display = arr.length ? 'none' : 'block';
    arr.forEach(function (s) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + (s.name || '-') + '</td><td>' + (s.phone || '-') + '</td><td>' + s.seatNo + '</td><td>' + (s.zoneName || s.zone) + '</td>';
      body.appendChild(tr);
    });
  }

  await renderSpeakers();
  await renderAgenda();
  await renderRegs();
  await renderSeats();
  await renderStats();

  /* ---------- 数据统计（P0-5） ---------- */
  async function renderStats() {
    var s = await S.getStats();
    var regs = await S.getRegs();
    var today = new Date().toISOString().slice(0, 10);
    var d = s.daily[today] || { pv: 0, uv: 0 };

    var cards = [
      { b: d.pv, t: '今日 PV' },
      { b: d.uv, t: '今日 UV' },
      { b: s.pv || 0, t: '累计 PV' },
      { b: s.uv || 0, t: '累计 UV' }
    ];
    $('statCards').innerHTML = cards.map(function (c) {
      return '<div class="sc"><b>' + c.b + '</b><span>' + c.t + '</span></div>';
    }).join('');

    /* 转化漏斗：访问 → 报名 → 座位查询 → 邀请函 */
    var pv = s.pv || 0;
    var regN = regs.length;
    var seatN = (s.actions && s.actions.seat) || 0;
    var inviteN = (s.actions && s.actions.invite) || 0;
    var funnel = [
      { lab: '访问微站', n: pv },
      { lab: '完成报名', n: regN },
      { lab: '查询座位', n: seatN },
      { lab: '生成邀请函', n: inviteN }
    ];
    var maxN = Math.max(pv, 1);
    $('statFunnel').innerHTML = funnel.map(function (f) {
      var pct = Math.round((f.n / maxN) * 100);
      return '<div class="row"><div class="lab">' + f.lab + '</div>' +
        '<div class="track"><div class="fillbar" style="width:' + pct + '%"></div></div>' +
        '<div class="num">' + f.n + '</div></div>';
    }).join('');

    /* 关键行为条形图 */
    var actMap = { reg: '报名', seat: '座位查询', invite: '邀请函', agenda: '查看议程', visit: '访问' };
    var acts = Object.keys(actMap).map(function (k) {
      return { lab: actMap[k], n: (s.actions && s.actions[k]) || 0 };
    }).filter(function (a) { return a.n > 0; })
      .sort(function (a, b) { return b.n - a.n; });
    var maxA = acts.length ? acts[0].n : 1;
    $('statActions').innerHTML = acts.length ? acts.map(function (a) {
      var pct = Math.round((a.n / maxA) * 100);
      return '<div class="row"><div class="lab">' + a.lab + '</div>' +
        '<div class="track"><div class="fillbar" style="width:' + pct + '%"></div></div>' +
        '<div class="num">' + a.n + '</div></div>';
    }).join('') : '<p class="note">暂无行为数据</p>';
  }

  /* ---------- 主题管理（v2.1 → v2.3：主题库 + 分组 + 缩略图） ---------- */
  async function renderThemes() {
    var themes = await S.listThemes();
    var groups = await S.listThemeGroups();
    var current = await S.getTheme();
    var cur = themes.filter(function (t) { return t.key === current; })[0];
    $('themeCurrent').textContent = cur ? (cur.name + ' · ' + cur.group) : current;
    $('themeGrid').innerHTML = groups.map(function (g) {
      var list = themes.filter(function (t) { return t.group === g; });
      return '<div class="theme-group"><h4>' + g + '<span>' + list.length + ' 套</span></h4><div class="theme-grid">' +
        list.map(function (t) {
          var on = t.key === current;
          return '<div class="theme-card' + (on ? ' on' : '') + '" data-key="' + t.key + '">' +
            '<div class="theme-thumb" style="background:' + t.preview + '">' +
              '<div class="theme-emoji">' + (t.emoji || '🎨') + '</div>' +
            '</div>' +
            '<div class="theme-name">' + t.name + '</div>' +
            '<div class="theme-desc">' + t.desc + '</div>' +
            '<div class="theme-foot"><b>key：</b><code>' + t.key + '</code></div>' +
            (on
              ? '<button class="btn sm" disabled>✓ 当前正在使用</button>'
              : '<button class="btn ghost sm" data-act="use">切换</button>') +
            '</div>';
        }).join('') + '</div></div>';
    }).join('');
    [].forEach.call($('themeGrid').querySelectorAll('.theme-card'), function (card) {
      var key = card.getAttribute('data-key');
      var btn = card.querySelector('[data-act=use]');
      if (btn) btn.onclick = function () { S.setTheme(key).then(function () { toast('已切换为：' + key); renderThemes(); }); };
    });
  }
  await renderThemes();

  /* ---------- 会议管理（v2.3→v2.4 加 URL 复制） ---------- */
  async function renderMeetings() {
    var list = await S.listMeetings();
    var cur = await S.getCurrentMeeting();
    $('meetingCurrent').textContent = cur ? (cur.name + '（' + cur.slug + '）') : '—';
    $('meetingGrid').innerHTML = list.map(function (m) {
      var on = cur && cur.id === m.id;
      var statusMap = { draft: '草稿', open: '报名中', ongoing: '进行中', closed: '已结束' };
      // 完整可分享 URL（基于当前页面位置推算；部署到子目录也适用）
      var base = location.href.split('?')[0].split('#')[0];
      var url = base.replace(/admin\.html$/, 'index.html') + '?m=' + encodeURIComponent(m.slug);
      return '<div class="meeting-card' + (on ? ' on' : '') + '" data-id="' + m.id + '">' +
        '<div class="m-head">' +
          '<b>' + m.name + '</b>' +
          (on ? '<span class="m-tag on">当前</span>' : '<span class="m-tag">' + (statusMap[m.status] || '草稿') + '</span>') +
        '</div>' +
        '<div class="m-meta">' + (m.summary || '<i style="color:var(--muted)">无简介</i>') + '</div>' +
        '<div class="m-url">' +
          '<span class="m-url-lab">微站 URL</span>' +
          '<code class="m-url-text" data-url="' + url + '">' + url + '</code>' +
          '<button class="btn ghost xs" data-act="copy">复制</button>' +
        '</div>' +
        '<div class="m-meta"><b>slug：</b><code>' + m.slug + '</code>　<b>语言：</b>' + (m.lang || 'zh-CN') + '　<b>创建：</b>' + (m.createdAt || '').slice(0, 10) + '</div>' +
        '<div class="m-ops">' +
          (on ? '<button class="btn sm" disabled>✓ 正在编辑</button>'
             : '<button class="btn ghost sm" data-act="use">切换为当前</button>') +
          '<button class="btn ghost sm" data-act="edit">编辑</button>' +
          (m.id !== 'm_default' ? '<button class="btn ghost sm del" data-act="del">删除</button>' : '') +
        '</div>' +
        '</div>';
    }).join('');
    [].forEach.call($('meetingGrid').querySelectorAll('.meeting-card'), function (card) {
      var id = card.getAttribute('data-id');
      card.querySelectorAll('[data-act]').forEach(function (b) {
        b.onclick = function () {
          var act = b.getAttribute('data-act');
          if (act === 'use')  return S.setCurrentMeeting(id).then(function () { renderAll(); toast('已切换会议'); });
          if (act === 'edit') return editMeeting(id);
          if (act === 'del')  return delMeeting(id);
          if (act === 'copy') return copyUrl(b.previousElementSibling.getAttribute('data-url'));
        };
      });
    });
  }
  /* 复制文本到剪贴板（兼容 HTTPS / file 协议） */
  function copyUrl(text) {
    function done() { toast('已复制：' + text); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); }
      catch (e) { toast('复制失败，请手动复制'); }
      document.body.removeChild(ta);
    }
  }
  window.editMeeting = async function (id) {
    var f = $('meetForm'); f.reset();
    if (id) {
      var m = await S.getMeeting(id);
      if (!m) { toast('会议不存在'); return; }
      $('meetTitle').textContent = '编辑会议';
      f.elements['id'].value = m.id;
      f.elements['name'].value = m.name || '';
      f.slug.value = m.slug || '';
      f.summary.value = m.summary || '';
      var st = f.querySelector('input[name=status][value=' + m.status + ']'); if (st) st.checked = true;
      var lg = f.querySelector('input[name=lang][value="' + (m.lang || 'zh-CN') + '"]'); if (lg) lg.checked = true;
    } else {
      $('meetTitle').textContent = '新建会议';
      f.elements['id'].value = '';
    }
    $('meetMask').classList.add('show');
  };
  window.delMeeting = async function (id) {
    if (!confirm('确认删除该会议？该会议的所有数据（嘉宾/议程/报名等）将一并清除（不可恢复）')) return;
    try { await S.removeMeeting(id); await renderAll(); toast('已删除'); }
    catch (e) { toast(e.message || '删除失败'); }
  };
  $('meetForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = e.target;
    var id = f.elements['id'].value;
    var data = {
      name: f.elements['name'].value.trim(),
      slug: f.slug.value.trim(),
      summary: f.summary.value.trim(),
      status: (f.querySelector('input[name=status]:checked') || {}).value || 'draft',
      lang: (f.querySelector('input[name=lang]:checked') || {}).value || 'zh-CN'
    };
    if (!data.name) { toast('会议名称必填'); return; }
    try {
      if (id) {
        await S.updateMeeting(id, data);
        toast('已保存');
      } else {
        var m = await S.addMeeting(data);
        // 切到新会议
        await S.setCurrentMeeting(m.id);
        toast('已创建并切换为当前会议');
      }
      $('meetMask').classList.remove('show');
      await renderAll();
    } catch (err) { toast(err.message || '保存失败'); }
  });
  /* v2.4：初始化时刷一次高亮条 + 标题 */
  try {
    var initCur = await S.getCurrentMeeting();
    if ($('currentBarName')) $('currentBarName').textContent = initCur ? (initCur.name + '（' + initCur.slug + '）') : '—';
    document.title = initCur ? ('【' + initCur.name + '】后台') : '会议管理后台';
  } catch (e) {}
  await renderMeetings();

  /* renderAll：会议切换后全局刷新（v2.4：所有 tab 全部重渲染 + 高亮条 + 只读元数据 + 主题下拉） */
  window.renderAll = async function () {
    var cur = await S.getCurrentMeeting();
    if ($('currentBarName')) $('currentBarName').textContent = cur ? (cur.name + '（' + cur.slug + '）') : '—';
    document.title = cur ? ('【' + cur.name + '】后台') : '会议管理后台';
    await renderMeetings();
    await paintMetaReadonly();
    await paintThemeSelect();
    await loadMetaForm();
    await renderSpeakers();
    await renderAgenda();
    await renderRegs();
    await renderSeats();
    await renderStats();
    await renderThemes();
    await renderModules();
  };

  /* ---------- Emoji 选择器（v2.3） ---------- */
  var emojiPickerTarget = null;
  var emojiPickerSelected = null;
  var emojiPickerGroups = [];
  window.openEmojiPicker = async function (targetInputId) {
    emojiPickerTarget = targetInputId;
    emojiPickerSelected = null;
    var lib = await S.listEmojiLibrary();
    emojiPickerGroups = lib;
    $('emojiTotal').textContent = lib.reduce(function (n, g) { return n + g.items.length; }, 0);
    $('emojiConfirm').disabled = true;
    renderEmojiTabs('');
    renderEmojiGrid('', '');
    $('emojiSearch').value = '';
    $('emojiSearch').oninput = function () {
      var kw = $('emojiSearch').value.trim();
      renderEmojiTabs(kw);
      renderEmojiGrid(kw, document.querySelector('.emoji-tab.active') && document.querySelector('.emoji-tab.active').getAttribute('data-g') || '');
    };
    $('emojiMask').classList.add('show');
  };
  function renderEmojiTabs(kw) {
    var filtered = kw
      ? emojiPickerGroups.filter(function (g) {
          return g.group.toLowerCase().indexOf(kw.toLowerCase()) >= 0 ||
                 g.name.toLowerCase().indexOf(kw.toLowerCase()) >= 0;
        })
      : emojiPickerGroups;
    $('emojiTabs').innerHTML = filtered.map(function (g) {
      return '<span class="emoji-tab" data-g="' + g.group + '">' + g.group + '（' + g.items.length + '）</span>';
    }).join('');
    var first = $('emojiTabs').querySelector('.emoji-tab');
    if (first) first.classList.add('active');
    [].forEach.call($('emojiTabs').querySelectorAll('.emoji-tab'), function (t) {
      t.onclick = function () {
        [].forEach.call($('emojiTabs').querySelectorAll('.emoji-tab'), function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        renderEmojiGrid($('emojiSearch').value.trim(), t.getAttribute('data-g'));
      };
    });
  }
  function renderEmojiGrid(kw, groupName) {
    var g = emojiPickerGroups.filter(function (x) { return x.group === groupName; })[0] || emojiPickerGroups[0];
    if (!g) { $('emojiGrid').innerHTML = '<p class="note">无匹配</p>'; return; }
    var items = g.items;
    if (kw) {
      items = emojiPickerGroups.reduce(function (acc, gg) {
        return acc.concat(gg.items.filter(function (e) { return e.indexOf(kw) >= 0; }));
      }, []);
    }
    $('emojiGrid').innerHTML = items.map(function (e) {
      return '<span class="emoji-cell" data-e="' + e + '">' + e + '</span>';
    }).join('') || '<p class="note">无匹配</p>';
    [].forEach.call($('emojiGrid').querySelectorAll('.emoji-cell'), function (c) {
      c.onclick = function () {
        [].forEach.call($('emojiGrid').querySelectorAll('.emoji-cell'), function (x) { x.classList.remove('sel'); });
        c.classList.add('sel');
        emojiPickerSelected = c.getAttribute('data-e');
        $('emojiConfirm').disabled = false;
      };
    });
  }
  $('emojiConfirm').onclick = function () {
    if (!emojiPickerSelected || !emojiPickerTarget) return;
    var inp = $(emojiPickerTarget);
    if (inp) {
      inp.value = emojiPickerSelected;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
    closeAdmin('emojiMask');
    toast('已选择：' + emojiPickerSelected);
  };

  /* ---------- 九宫格模块（v2.2 新增） ---------- */
  async function renderModules() {
    var list = await S.listModules();
    var body = $('moduleList');
    body.innerHTML = list.map(function (m) {
      var icon = m.iconUrl
        ? '<span class="m-ico"><img src="' + m.iconUrl + '" alt=""></span>'
        : '<span class="m-ico">' + (m.icon || '•') + '</span>';
      var sysTag = m.type === 'system' ? '<span class="m-tag sys">系统</span>' : '<span class="m-tag cus">自定义</span>';
      var priTag = m.primary ? '<span class="m-tag pri">主推</span>' : '';
      var offTag = m.enabled === false ? '<span class="m-tag off">已关闭</span>' : '';
      return '<li class="m-item' + (m.enabled === false ? ' off' : '') + '" data-id="' + m.id + '">' +
        '<div class="m-handle" title="拖动排序">≡</div>' +
        icon +
        '<div class="m-meta"><b>' + m.label + '</b><span>' + (m.desc || m.href || '') + '</span></div>' +
        '<div class="m-tags">' + sysTag + priTag + offTag + '</div>' +
        '<div class="m-ops">' +
          '<span class="op" data-act="up" title="上移">↑</span>' +
          '<span class="op" data-act="down" title="下移">↓</span>' +
          '<span class="op" data-act="toggle" title="启用/关闭">' + (m.enabled === false ? '启用' : '关闭') + '</span>' +
          '<span class="op" data-act="edit">编辑</span>' +
          (m.type === 'custom' ? '<span class="op del" data-act="del">删除</span>' : '') +
        '</div>' +
        '</li>';
    }).join('');
    [].forEach.call(body.querySelectorAll('.m-item'), function (li) {
      var id = li.getAttribute('data-id');
      li.querySelectorAll('[data-act]').forEach(function (op) {
        op.onclick = function (e) {
          var act = op.getAttribute('data-act');
          if (act === 'up')   return moveModule(id, -1);
          if (act === 'down') return moveModule(id, 1);
          if (act === 'toggle') return S.updateModule(id, { enabled: !isEnabled(li) }).then(renderModules);
          if (act === 'edit')  return editModule(id);
          if (act === 'del')   return delModule(id);
        };
      });
    });
  }
  function isEnabled(li) { return li && !li.classList.contains('off'); }

  async function moveModule(id, dir) {
    var list = await S.listModules();
    var ids = list.map(function (m) { return m.id; });
    var i = ids.indexOf(id);
    var j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    var tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
    await S.reorderModules(ids);
    renderModules();
  }

  window.editModule = async function (id) {
    var f = $('modForm');
    f.reset();
    if (id) {
      var m = await S.getModule(id);
      if (!m) { toast('模块不存在'); return; }
      $('modTitle').textContent = m.type === 'system' ? '编辑系统模块' : '编辑自定义模块';
      f.elements['id'].value = m.id;
      f.type.value = m.type;
      f.label.value = m.label || '';
      f.iconOrUrl.value = m.iconUrl || m.icon || '';
      f.href.value = m.href || '';
      f.elements['target'].value = m.target || '_self';
      f.enabled.checked = m.enabled !== false;
      if (m.config) {
        f.cfg_title.value = m.config.title || '';
        f.cfg_body.value = m.config.body || '';
        f.cfg_link.value = m.config.link || '';
        f.cfg_linkText.value = m.config.linkText || '';
      }
      // 系统模块的某些字段禁用
      var locked = m.type === 'system';
      f.href.readOnly = false; // system 也允许改 href（指向不同 section）
    } else {
      $('modTitle').textContent = '新增自定义模块';
      f.elements['id'].value = '';
      f.type.value = 'custom';
      f.enabled.checked = true;
    }
    $('modMask').classList.add('show');
    paintIconPreview();
  };
  function paintIconPreview() {
    var v = $('modForm').iconOrUrl.value.trim();
    var box = $('iconPreview');
    if (!box) return;
    if (/^https?:\/\//i.test(v)) box.innerHTML = '<img src="' + v + '" alt="icon" onerror="this.outerHTML=\'<i>加载失败</i>\'">';
    else if (v) box.innerHTML = '<span style="font-size:32px;line-height:1">' + v + '</span>';
    else box.innerHTML = '<i>未设置</i>';
  }

  window.delModule = async function (id) {
    if (!confirm('确认删除该自定义模块？')) return;
    try { await S.removeModule(id); await renderModules(); toast('已删除'); }
    catch (e) { toast(e.message || '删除失败'); }
  };

  window.resetModules = async function () {
    if (!confirm('确认重置为系统默认 11 个模块？已有自定义模块将丢失（系统模块会被恢复）。')) return;
    await S.resetModules();
    await renderModules();
    toast('已重置');
  };

  $('modForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = e.target;
    var id = f.elements['id'].value;
    var iconOrUrl = f.iconOrUrl.value.trim();
    var icon = iconOrUrl, iconUrl = '';
    if (/^https?:\/\//i.test(iconOrUrl)) { icon = ''; iconUrl = iconOrUrl; }
    var patch = {
      label: f.label.value.trim(),
      icon: icon, iconUrl: iconUrl,
      href: f.href.value.trim(),
      target: f.elements['target'].value,
      enabled: f.enabled.checked
    };
    if (!patch.label) { toast('模块名必填'); return; }
    if (!id) {
      // 新增
      var data = patch;
      data.config = {
        title: f.cfg_title.value.trim(),
        body:  f.cfg_body.value.trim(),
        link:  f.cfg_link.value.trim(),
        linkText: f.cfg_linkText.value.trim()
      };
      try { await S.addModule(data); $('modMask').classList.remove('show'); await renderModules(); toast('已新增'); }
      catch (e) { toast(e.message || '新增失败'); }
    } else {
      // 编辑：custom 模块允许改 config
      var cur = await S.getModule(id);
      if (cur && cur.type === 'custom') {
        patch.config = {
          title: f.cfg_title.value.trim(),
          body:  f.cfg_body.value.trim(),
          link:  f.cfg_link.value.trim(),
          linkText: f.cfg_linkText.value.trim()
        };
      }
      try { await S.updateModule(id, patch); $('modMask').classList.remove('show'); await renderModules(); toast('已保存'); }
      catch (e) { toast(e.message || '保存失败'); }
    }
  });

  $('modForm').iconOrUrl.oninput = paintIconPreview;

  await renderModules();
})();
