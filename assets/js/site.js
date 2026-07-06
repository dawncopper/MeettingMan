/* ============================================================
 * 会议信息管理系统 - 微站前端逻辑
 * ============================================================ */
(function () {
  'use strict';
  var S = window.ConfStore;
  S.ensureSeed();

  var meta = S.getMeta();
  var speakers = S.getSpeakers();
  var agenda = S.getAgenda();
  var materials = S.getMaterials();

  /* ---------- 渲染基本信息 ---------- */
  function fill(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

  fill('brandSub', meta.shortTitle || 'Conference System');
  fill('heroTitle', meta.title);
  fill('heroEn', meta.enTitle);
  fill('heroTheme', '主题 · ' + (meta.theme || ''));
  fill('heroDate', fmtRange(meta.date, meta.endDate));
  fill('heroVenue', meta.venue);
  fill('heroCity', meta.city);
  fill('aboutText', meta.about);

  // 标签
  var tagsEl = document.getElementById('aboutTags');
  (meta.highlights || []).forEach(function (t) {
    var li = document.createElement('li'); li.textContent = t; tagsEl.appendChild(li);
  });

  // 数据概览
  fill('stDays', diffDays(meta.date, meta.endDate) + 1);
  fill('stSpeakers', speakers.length + '+');
  fill('stSessions', countSessions(agenda) + '+');
  function refreshRegCount() { fill('stRegs', S.getRegs().length); }
  refreshRegCount();

  // 嘉宾
  var grid = document.getElementById('speakerGrid');
  fill('speakerCount', speakers.length + ' 位嘉宾');
  speakers.forEach(function (sp) {
    var d = document.createElement('div');
    d.className = 'speaker';
    d.innerHTML =
      '<div class="ava" style="background:' + (sp.color || '#2f54eb') + '">' + (sp.avatar || sp.name.slice(0, 1)) + '</div>' +
      '<h4>' + sp.name + '</h4>' +
      '<div class="role">' + sp.title + ' · ' + sp.org + '</div>' +
      '<div class="topic">' + (sp.topic || '') + '</div>';
    grid.appendChild(d);
  });

  // 会场信息
  var venueInfo = document.getElementById('venueInfo');
  [
    ['场馆', meta.venue],
    ['地址', meta.address],
    ['会期', fmtRange(meta.date, meta.endDate)],
    ['主题', meta.theme]
  ].forEach(function (row) {
    var li = document.createElement('li');
    li.innerHTML = '<span class="k">' + row[0] + '</span><span class="v">' + row[1] + '</span>';
    venueInfo.appendChild(li);
  });

  // 资料
  var resList = document.getElementById('resList');
  materials.forEach(function (m) {
    var li = document.createElement('li');
    li.innerHTML =
      '<div class="ic">' + (m.tag || '文') + '</div>' +
      '<div class="meta"><b>' + m.name + '</b><span>' + (m.size || '') + '</span></div>' +
      '<button class="btn ghost sm" onclick="toast(\'开始下载：' + m.name + '\')">下载</button>';
    resList.appendChild(li);
  });

  // 联系
  var contactInfo = document.getElementById('contactInfo');
  [
    ['电话', meta.contact.phone],
    ['邮箱', meta.contact.email],
    ['微信', meta.contact.wechat]
  ].forEach(function (row) {
    var li = document.createElement('li');
    li.innerHTML = '<span class="k">' + row[0] + '</span><span class="v">' + row[1] + '</span>';
    contactInfo.appendChild(li);
  });

  /* ---------- 议程 + 日期切换 ---------- */
  var dayTabs = document.getElementById('dayTabs');
  var agendaList = document.getElementById('agendaList');
  var activeDay = 0;

  agenda.forEach(function (day, i) {
    var b = document.createElement('button');
    b.textContent = day.day;
    b.className = i === 0 ? 'active' : '';
    b.onclick = function () { activeDay = i; renderAgenda(); syncDayTabs(); };
    dayTabs.appendChild(b);
  });
  function syncDayTabs() {
    [].forEach.call(dayTabs.children, function (c, i) { c.className = i === activeDay ? 'active' : ''; });
  }
  function renderAgenda() {
    agendaList.innerHTML = '';
    (agenda[activeDay].sessions || []).forEach(function (s) {
      var item = document.createElement('div');
      item.className = 'item';
      item.innerHTML =
        '<div class="time">' + s.time + '</div>' +
        '<div class="body"><h4>' + s.title + typePill(s.type) + '</h4><p>' + s.speaker + '</p></div>';
      agendaList.appendChild(item);
    });
  }
  renderAgenda();

  /* ---------- 倒计时 ---------- */
  var target = new Date(meta.date + 'T09:00:00').getTime();
  function tick() {
    var now = Date.now();
    var diff = Math.max(0, target - now);
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    fill('cdD', pad(d)); fill('cdH', pad(h)); fill('cdM', pad(m)); fill('cdS', pad(s));
  }
  tick(); setInterval(tick, 1000);

  /* ---------- 弹层 ---------- */
  window.openReg = function () {
    document.getElementById('regForm').style.display = '';
    document.getElementById('regDone').style.display = 'none';
    showMask('regMask');
  };
  window.openSeat = function () { showMask('seatMask'); };
  window.closeMask = function (id) { document.getElementById(id).classList.remove('show'); };
  function showMask(id) { document.getElementById(id).classList.add('show'); }
  ['regMask', 'seatMask'].forEach(function (id) {
    document.getElementById(id).addEventListener('click', function (e) {
      if (e.target === this) this.classList.remove('show');
    });
  });

  /* ---------- 报名提交 ---------- */
  document.getElementById('regForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    var name = f.name.value.trim();
    var phone = f.phone.value.trim();
    var org = f.org.value.trim();
    var ok = true;
    ok = validate('f-name', name) && ok;
    ok = validate('f-phone', /^1\d{10}$/.test(phone)) && ok;
    ok = validate('f-org', org) && ok;
    if (!f.agree.checked) { toast('请先同意参会须知'); return; }
    if (!ok) return;

    var reg = S.addReg({
      name: name, phone: phone, org: org, title: f.title.value.trim(),
      ticket: (f.querySelector('input[name=ticket]:checked') || {}).value || '',
      hotel: (f.querySelector('input[name=hotel]:checked') || {}).value || '',
      agree: true
    });
    // 预先分配座位
    S.findSeat(name, phone);
    f.reset();
    refreshRegCount();
    document.getElementById('regCode').textContent = 'NO. ' + reg.id.slice(-6).toUpperCase();
    f.style.display = 'none';
    document.getElementById('regDone').style.display = '';
    toast('报名成功');
  });

  /* ---------- 座位查询提交 ---------- */
  document.getElementById('seatForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    var name = f.name.value.trim();
    var phone = f.phone.value.trim();
    var ok = validate('sf-name', name) && validate('sf-phone', /^1\d{10}$/.test(phone));
    if (!ok) return;
    var seat = S.findSeat(name, phone);
    var box = document.getElementById('seatResult');
    f.style.display = 'none';
    if (!seat) {
      box.style.display = '';
      box.innerHTML = '<div class="result"><div style="font-size:42px">😢</div><h3>未找到座位</h3><p style="color:var(--ink-2)">未查询到该报名记录，请确认姓名与手机号，或先完成报名。</p><button class="btn ghost block" onclick="resetSeatForm()">重新输入</button></div>';
      return;
    }
    box.style.display = '';
    box.innerHTML = renderSeatResult(seat);
  });

  window.resetSeatForm = function () {
    document.getElementById('seatForm').style.display = '';
    document.getElementById('seatResult').style.display = 'none';
    document.getElementById('seatForm').reset();
  };

  /* ---------- Toast ---------- */
  var toastTimer;
  window.toast = function (msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  };

  /* ---------- 底部 Tab 高亮 ---------- */
  var tabs = document.querySelectorAll('#tabbar a[data-tab]');
  window.addEventListener('scroll', function () {
    var pos = window.scrollY + 80;
    var current = 'home';
    ['home', 'agenda', 'speakers', 'venue', 'seat'].forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec && sec.offsetTop <= pos) current = id;
    });
    tabs.forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-tab') === current); });
    // 桌面导航高亮
    document.querySelectorAll('.topnav a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      a.classList.toggle('active', href === '#' + current);
    });
  }, { passive: true });

  /* ---------- 工具函数 ---------- */
  function validate(fieldId, cond) {
    var f = document.getElementById(fieldId);
    if (cond) { f.classList.remove('invalid'); return true; }
    f.classList.add('invalid'); return false;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function diffDays(a, b) {
    if (!a || !b) return 1;
    return Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000));
  }
  function fmtRange(a, b) {
    if (!a) return '';
    var fa = a.slice(5).replace('-', '月') + '日';
    if (!b || a === b) return a.slice(0, 4) + '年' + fa;
    return a.slice(0, 4) + '年' + fa + ' - ' + b.slice(5).replace('-', '月') + '日';
  }
  function countSessions(ag) {
    var n = 0; (ag || []).forEach(function (d) { n += (d.sessions || []).length; }); return n;
  }
  function typePill(t) {
    var map = { ceremony: '仪式', keynote: '主旨', roundtable: '圆桌', forum: '分论坛', release: '发布', match: '对接' };
    return t ? '<span class="type-pill type-' + t + '">' + (map[t] || '') + '</span>' : '';
  }
  function renderSeatResult(seat) {
    return '<div class="result">' +
      '<div style="font-size:42px">🎫</div>' +
      '<h3>查询成功</h3>' +
      '<div class="big">' + seat.seatNo + '</div>' +
      '<p style="color:var(--ink-2);margin:0">' + (seat.zoneName || '') + '<br/>姓名：' + (seat.name || '-') + '</p>' +
      '<div class="seat-vis">' + seatMiniMap(seat) + '</div>' +
      '<button class="btn ghost block" onclick="resetSeatForm()">重新查询</button>' +
      '</div>';
  }
  function seatMiniMap(mine) {
    // 仅渲染 mine 所在区的前 4 排示意
    var zone = (S.ZONES || []).filter(function (z) { return z.code === mine.zone; })[0];
    if (!zone) return '';
    var rows = Math.min(4, zone.rows);
    var cols = zone.cols;
    var html = '<div class="stage">舞 台 / 主 席 台</div><div class="seat-grid">';
    for (var r = 1; r <= rows; r++) {
      html += '<div class="row"><span class="rl">' + r + '</span>';
      for (var c = 1; c <= cols; c++) {
        var cls = 'seat';
        if (r === mine.row && c === mine.col) cls += ' mine';
        html += '<span class="' + cls + '"></span>';
      }
      html += '</div>';
    }
    html += '</div><div class="legend"><span><i style="background:#f0b429"></i>我的座位</span><span><i style="background:#e9ecf5"></i>空闲</span></div>';
    return html;
  }
})();
