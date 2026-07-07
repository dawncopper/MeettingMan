/* ============================================================
 * 会议信息管理系统 - 微站前端逻辑 v2
 * 依赖：assets/js/data.js（ConfStore async API）
 * ============================================================ */
(async function () {
  'use strict';
  var S = window.ConfStore;
  await S.init();
  function escAttr(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  /* v2.4 多会议路由：?m=<slug> 切换当前会议
   * 串行执行：先 listMeetings → 匹配 → setCurrentMeeting，再读数据
   * 无参数或找不到时，保持用户已选的会议 */
  await (async function applyMeetingRoute() {
    try {
      var params = new URLSearchParams(window.location.search);
      var slug = params.get('m');
      if (slug) {
        var list = await S.listMeetings();
        var hit = list.filter(function (m) { return m.slug === slug; })[0];
        if (hit) {
          await S.setCurrentMeeting(hit.id);
          // 微站标题/品牌同步当前会议
          document.title = (hit.name || '会议') + ' · 微站';
        } else {
          // slug 不存在 → 仍读 URL，但提示一次
          console.warn('[site] ?m=' + slug + ' 未找到对应会议，使用当前会议');
        }
      }
    } catch (e) { /* ignore */ }
  })();

  var meta = await S.getMeta();
  var speakers = await S.getSpeakers();
  var agenda = await S.getAgenda();
  var materials = await S.getMaterials();
  var modules = await S.listModules({ enabledOnly: true });

  /* 提醒状态（P0-4）：当前查询用户 + 其全部议程的绝对开始时间 */
  var notifUserKey = null;   // '姓名|手机'
  var lastMe = null;         // {name, phone}
  var allSessions = [];
  agenda.forEach(function (day) {
    (day.sessions || []).forEach(function (s) {
      var t = (s.time || '').split('-')[0].trim();
      if (!/^\d{1,2}:\d{2}$/.test(t)) return;
      var dt = new Date(day.date + 'T' + t + ':00');
      if (isNaN(dt.getTime())) return;
      allSessions.push({ title: s.title, speaker: s.speaker, start: dt.getTime() });
    });
  });
  allSessions.sort(function (a, b) { return a.start - b.start; });

  /* 访问统计（P0-5）：PV + UV 去重 */
  await S.getClientId();
  S.track('visit');
  var agendaTracked = false;

  /* ---------- 渲染基本信息 ---------- */
  function fill(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

  fill('brandSub', meta.shortTitle || meta.title || 'Conference System');
  fill('heroTitle', meta.title);
  fill('heroEn', meta.enTitle);
  // heroTheme: v2.7 默认主题不显示主题（LA 主题走独立页 index-la.html）
  fill('heroTheme', '');
  fill('heroDate', fmtRange(meta.date, meta.endDate));
  fill('heroVenue', meta.venue);
  fill('heroCity', meta.city);
  fill('aboutText', meta.about);

  /* v2.3：会议视觉资产 */
  if (meta.bgColor) {
    document.documentElement.style.setProperty('--brand', meta.bgColor);
  }
  if (meta.bgImage) {
    var hero = document.querySelector('.hero');
    if (hero) {
      hero.style.backgroundImage = 'linear-gradient(120deg, rgba(0,0,0,.55), rgba(0,0,0,.25)), url(' + meta.bgImage + ')';
      hero.style.backgroundSize = 'cover';
      hero.style.backgroundPosition = 'center';
    }
  }
  if (meta.logo) {
    var brand = document.querySelector('.brand');
    if (brand) {
      var img = document.createElement('img');
      img.src = meta.logo;
      img.alt = 'logo';
      img.style.height = '34px';
      img.style.borderRadius = '8px';
      brand.insertBefore(img, brand.firstChild);
    }
  }

  // 标签
  var tagsEl = document.getElementById('aboutTags');
  (meta.highlights || []).forEach(function (t) {
    var li = document.createElement('li'); li.textContent = t; tagsEl.appendChild(li);
  });

  // 数据概览
  fill('stDays', diffDays(meta.date, meta.endDate) + 1);
  fill('stSpeakers', speakers.length + '+');
  fill('stSessions', countSessions(agenda) + '+');
  async function refreshRegCount() { fill('stRegs', (await S.getRegs()).length); }
  await refreshRegCount();

  // 嘉宾
  var grid = document.getElementById('speakerGrid');
  fill('speakerCount', speakers.length + ' 位嘉宾');
  speakers.forEach(function (sp) {
    var d = document.createElement('div');
    d.className = 'speaker';
    var ava = sp.photo
      ? '<img class="ava" src="' + escAttr(sp.photo) + '" alt="' + escAttr(sp.name) + '" />'
      : '<div class="ava" style="background:' + escAttr(sp.color || '#2f54eb') + '">' + escAttr(sp.avatar || (sp.name || '?').slice(0, 1)) + '</div>';
    d.innerHTML =
      ava +
      '<h4>' + escAttr(sp.name) + '</h4>' +
      '<div class="role">' + escAttr(sp.title) + ' · ' + escAttr(sp.org) + '</div>' +
      '<div class="topic">' + escAttr(sp.topic || '') + '</div>';
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
  window.openMe = function () { showMask('meMask'); };
  window.closeMask = function (id) { document.getElementById(id).classList.remove('show'); };
  function showMask(id) { document.getElementById(id).classList.add('show'); }
  ['regMask', 'seatMask', 'meMask', 'inviteMask', 'customMask'].forEach(function (id) {
    document.getElementById(id).addEventListener('click', function (e) {
      if (e.target === this) this.classList.remove('show');
    });
  });

  /* ---------- 报名方式切换（个人 / 团队） ---------- */
  var regForm = document.getElementById('regForm');
  var singleFields = document.getElementById('singleFields');
  var teamBox = document.getElementById('teamBox');
  var memberList = document.getElementById('memberList');
  var memberCount = document.getElementById('memberCount');
  var MAX_MEMBERS = 20;

  function syncMode() {
    var team = regForm.querySelector('input[name=mode]:checked').value === 'team';
    teamBox.style.display = team ? '' : 'none';
    singleFields.style.display = team ? 'none' : '';
  }
  regForm.querySelectorAll('input[name=mode]').forEach(function (r) { r.addEventListener('change', syncMode); });

  function renderMemberCount() {
    memberCount.textContent = memberList.children.length + '/' + MAX_MEMBERS;
  }
  function addMemberRow(data) {
    if (memberList.children.length >= MAX_MEMBERS) { toast('最多添加 ' + MAX_MEMBERS + ' 位成员'); return; }
    data = data || {};
    var row = document.createElement('div');
    row.className = 'member-row';
    row.innerHTML =
      '<input name="m_name" placeholder="姓名" value="' + (data.name || '') + '" />' +
      '<input name="m_phone" inputmode="numeric" maxlength="11" placeholder="手机" value="' + (data.phone || '') + '" />' +
      '<input name="m_org" placeholder="单位" value="' + (data.org || '') + '" />' +
      '<button type="button" class="member-del" title="删除">×</button>';
    row.querySelector('.member-del').onclick = function () { row.remove(); renderMemberCount(); };
    memberList.appendChild(row);
    renderMemberCount();
  }
  document.getElementById('addMember').addEventListener('click', function () { addMemberRow(); });
  syncMode();
  renderMemberCount();

  /* ---------- 报名提交 ---------- */
  regForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = e.target;
    var team = f.querySelector('input[name=mode]:checked').value === 'team';

    if (team) {
      /* ---- 团队报名 ---- */
      var teamName = f.teamName.value.trim();
      var leader = f.leader.value.trim();
      var invoice = f.invoice.value.trim();
      var ok = true;
      ok = validate('f-teamName', teamName) && ok;
      ok = validate('f-leader', leader) && ok;
      if (!f.agree.checked) { toast('请先同意参会须知'); return; }
      if (!ok) return;

      var rows = [].slice.call(memberList.children);
      if (!rows.length) { toast('请至少添加 1 位团队成员'); return; }
      var regs = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var nm = r.querySelector('input[name=m_name]').value.trim();
        var ph = r.querySelector('input[name=m_phone]').value.trim();
        var og = r.querySelector('input[name=m_org]').value.trim();
        if (!nm || !/^1\d{10}$/.test(ph)) { toast('第 ' + (i + 1) + ' 位成员信息有误（姓名/11位手机必填）'); return; }
        regs.push({ name: nm, phone: ph, org: og, title: '', teamName: teamName, teamLeader: leader, invoiceTitle: invoice });
      }
      var teamId = S.uid('team');
      var orderNo = 'T' + Date.now().toString(36).toUpperCase();
      var ticket = (f.querySelector('input[name=ticket]:checked') || {}).value || '';
      var hotel = (f.querySelector('input[name=hotel]:checked') || {}).value || '';
      regs.forEach(function (x) { x.teamId = teamId; x.orderNo = orderNo; x.ticket = ticket; x.hotel = hotel; x.agree = true; });

      await S.addTeamRegs(regs);
      for (var j = 0; j < regs.length; j++) { await S.findSeat(regs[j].name, regs[j].phone); }

      f.reset(); memberList.innerHTML = ''; renderMemberCount(); syncMode();
      await refreshRegCount();
      S.track('reg');
      document.getElementById('regCode').textContent = '订单 ' + orderNo;
      document.getElementById('regDoneMsg').textContent = '团队报名成功！共 ' + regs.length + ' 人，已自动分配座位。';
      f.style.display = 'none';
      document.getElementById('regDone').style.display = '';
      toast('团队报名成功');
      return;
    }

    /* ---- 个人报名 ---- */
    var name = f.name.value.trim();
    var phone = f.phone.value.trim();
    var org = f.org.value.trim();
    var ok2 = true;
    ok2 = validate('f-name', name) && ok2;
    ok2 = validate('f-phone', /^1\d{10}$/.test(phone)) && ok2;
    ok2 = validate('f-org', org) && ok2;
    if (!f.agree.checked) { toast('请先同意参会须知'); return; }
    if (!ok2) return;

    var reg = await S.addReg({
      name: name, phone: phone, org: org, title: f.title.value.trim(),
      ticket: (f.querySelector('input[name=ticket]:checked') || {}).value || '',
      hotel: (f.querySelector('input[name=hotel]:checked') || {}).value || '',
      agree: true
    });
    await S.findSeat(name, phone);
    f.reset();
    await refreshRegCount();
    S.track('reg');
    document.getElementById('regCode').textContent = 'NO. ' + reg.id.slice(-6).toUpperCase();
    document.getElementById('regDoneMsg').textContent = '您的专属座位已生成，可在「座位查询」中查看。入场凭证已模拟发送，请截图保存。';
    f.style.display = 'none';
    document.getElementById('regDone').style.display = '';
    toast('报名成功');
  });

  /* ---------- 座位查询提交 ---------- */
  document.getElementById('seatForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = e.target;
    var name = f.name.value.trim();
    var phone = f.phone.value.trim();
    var ok = validate('sf-name', name) && validate('sf-phone', /^1\d{10}$/.test(phone));
    if (!ok) return;
    var seat = await S.findSeat(name, phone);
    var box = document.getElementById('seatResult');
    f.style.display = 'none';
    S.track('seat');
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

  /* ---------- 个人中心查询 ---------- */
  document.getElementById('meForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = e.target;
    var name = f.name.value.trim();
    var phone = f.phone.value.trim();
    var ok = validate('mf-name', name) && validate('mf-phone', /^1\d{10}$/.test(phone));
    if (!ok) return;
    var reg = await S.getMyReg(name, phone);
    var box = document.getElementById('meResult');
    f.style.display = 'none';
    if (!reg) {
      box.style.display = '';
      box.innerHTML = '<div class="result"><div style="font-size:42px">🔍</div><h3>未找到报名</h3><p style="color:var(--ink-2)">未查询到该报名记录，请确认姓名与手机号。</p><button class="btn ghost block" onclick="resetMeForm()">重新输入</button></div>';
      return;
    }
    var seat = await S.findSeat(name, phone);
    lastMe = { name: name, phone: phone };
    notifUserKey = name + '|' + phone;
    var html = '<div class="result" style="text-align:left">';
    html += '<h3 style="text-align:center">我的参会</h3>';
    html += '<div class="kv"><span>姓名</span><b>' + reg.name + '</b></div>';
    html += '<div class="kv"><span>单位</span><b>' + (reg.org || '-') + '</b></div>';
    html += '<div class="kv"><span>票种</span><b>' + (reg.ticket || '-') + '</b></div>';
    html += '<div class="kv"><span>住宿</span><b>' + (reg.hotel || '-') + '</b></div>';
    if (seat) {
      html += '<div class="kv"><span>我的座位</span><b style="color:#2f54eb">' + seat.seatNo + '</b></div>';
      html += '<div class="seat-vis" style="margin:10px 0">' + seatMiniMap(seat) + '</div>';
    }
    if (reg.teamId) {
      var team = await S.getRegsByTeam(reg.teamId);
      html += '<div class="kv"><span>团队</span><b>' + (reg.teamName || '') + '</b></div>';
      html += '<div class="kv"><span>订单号</span><b>' + (reg.orderNo || '') + '</b></div>';
      html += '<div class="kv"><span>团队人数</span><b>' + team.length + ' 人</b></div>';
    }
    /* 会前提醒设置（P0-4） */
    html += '<div class="remind-box" id="remindBox">';
    html += '<div class="line"><span>开启会前提醒</span><label class="switch"><input type="checkbox" id="notifToggle"><span class="slider"></span></label></div>';
    html += '<div class="line"><span>提前提醒</span><select id="notifBefore"><option value="15">15 分钟</option><option value="60" selected>1 小时</option><option value="1440">1 天</option></select></div>';
    html += '<div class="upc" id="upcList"></div>';
    html += '</div>';
    html += '<div style="text-align:center;margin-top:12px"><button class="btn ghost block" onclick="openInvite(lastMe.name, lastMe.phone)">生成邀请函</button>' +
            '<button class="btn ghost block" style="margin-top:8px" onclick="resetMeForm()">查询其他</button></div>';
    html += '</div>';
    box.style.display = '';
    box.innerHTML = html;
    setupRemind();
  });

  window.resetMeForm = function () {
    document.getElementById('meForm').style.display = '';
    document.getElementById('meResult').style.display = 'none';
    document.getElementById('meForm').reset();
  };

  /* ---------- 会前提醒（P0-4） ---------- */
  function fmtClock(ms) {
    var d = new Date(ms);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function setupRemind() {
    var toggle = document.getElementById('notifToggle');
    var sel = document.getElementById('notifBefore');
    if (!toggle || !sel) return;
    S.getNotif(notifUserKey).then(function (opts) {
      opts = opts || {};
      toggle.checked = !!opts.enabled;
      sel.value = String(opts.beforeMin || 60);
      renderUpcoming(opts);
      toggle.onchange = function () {
        if (toggle.checked && 'Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
        var o = { enabled: toggle.checked, beforeMin: +sel.value, last: (opts.last || {}) };
        S.setNotif(notifUserKey, o).then(function () { toast(toggle.checked ? '已开启会前提醒' : '已关闭提醒'); });
      };
      sel.onchange = function () {
        var o = { enabled: toggle.checked, beforeMin: +sel.value, last: (opts.last || {}) };
        S.setNotif(notifUserKey, o);
      };
    });
  }
  function renderUpcoming(opts) {
    var box = document.getElementById('upcList');
    if (!box) return;
    var now = Date.now();
    var list = allSessions.filter(function (s) { return s.start > now; }).slice(0, 4);
    if (!list.length) { box.innerHTML = '<p class="note">暂无可提醒的 upcoming 议程</p>'; return; }
    var on = opts && opts.enabled;
    box.innerHTML = list.map(function (s) {
      return '<div class="item"><span>' + fmtClock(s.start) + ' · ' + s.title + '</span><span class="' + (on ? 'on' : 'off') + '">' + (on ? '将提醒' : '未开启') + '</span></div>';
    }).join('');
  }
  function fireNotif(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body: body }); } catch (e) {}
    }
    toast(title + '：' + body);
  }
  function checkReminders() {
    if (!notifUserKey) return;
    S.getNotif(notifUserKey).then(function (opts) {
      if (!opts || !opts.enabled) return;
      var now = Date.now();
      var before = (opts.beforeMin || 60) * 60000;
      var last = opts.last || {};
      var changed = false;
      allSessions.forEach(function (s) {
        var key = s.title + '@' + s.start;
        var diff = s.start - now;
        var within = diff > 0 && diff <= before;
        var notifiedRecently = last[key] && (now - last[key] < 86400000);
        if (within && !notifiedRecently) {
          fireNotif('会议提醒', s.title + ' 将于 ' + fmtClock(s.start) + ' 开始');
          last[key] = now; changed = true;
        }
      });
      if (changed) S.setNotif(notifUserKey, { enabled: opts.enabled, beforeMin: opts.beforeMin, last: last });
    });
  }
  function startReminderScheduler() { checkReminders(); setInterval(checkReminders, 30000); }

  /* ---------- 邀请函海报（P0-3，原生 Canvas，离线可用） ---------- */
  window.openInvite = async function (name, phone) {
    var reg = await S.getMyReg(name, phone);
    if (!reg) { toast('请先在个人中心查询'); return; }
    var seat = await S.findSeat(name, phone);
    drawInvitePoster(reg, seat);
    showMask('inviteMask');
    S.track('invite');
  };
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    var chars = (text || '').split('');
    var line = '', lines = [];
    for (var i = 0; i < chars.length; i++) {
      var test = line + chars[i];
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = chars[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    var startY = y - (lines.length - 1) * lineHeight / 2;
    lines.forEach(function (l, i) { ctx.fillText(l, x, startY + i * lineHeight); });
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function drawQR(ctx, cx, cy, size, text) {
    var holder = document.createElement('div');
    holder.style.position = 'absolute'; holder.style.left = '-9999px'; holder.style.top = '0';
    document.body.appendChild(holder);
    var paint = function () {
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, cx - size / 2, cy - size / 2, size, size, 18); ctx.fill();
      var c = holder.querySelector('canvas');
      var img = holder.querySelector('img');
      var pad = 22;
      if (c) {
        ctx.drawImage(c, cx - size / 2 + pad, cy - size / 2 + pad, size - pad * 2, size - pad * 2);
      } else if (img && img.src) {
        var im = new Image();
        im.onload = function () { ctx.drawImage(im, cx - size / 2 + pad, cy - size / 2 + pad, size - pad * 2, size - pad * 2); };
        im.src = img.src;
      } else {
        ctx.fillStyle = '#2f54eb'; ctx.textAlign = 'center'; ctx.font = '30px sans-serif';
        ctx.fillText('扫码报名', cx, cy + 10);
      }
      holder.remove();
    };
    if (window.QRCode) {
      try {
        new QRCode(holder, { text: text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
        setTimeout(paint, 80);
      } catch (e) { paint(); }
    } else { paint(); }
  }
  function drawInvitePoster(reg, seat) {
    var cv = document.getElementById('inviteCanvas');
    cv.width = 1080; cv.height = 1920;
    var ctx = cv.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 1080, 1920);
    g.addColorStop(0, '#1d2b6b'); g.addColorStop(0.5, '#2f54eb'); g.addColorStop(1, '#722ed1');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
    var rg = ctx.createRadialGradient(900, 120, 40, 900, 120, 420);
    rg.addColorStop(0, 'rgba(240,180,41,0.35)'); rg.addColorStop(1, 'rgba(240,180,41,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, 1080, 1920);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f0b429';
    ctx.font = 'bold 70px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('邀 请 函', 540, 230);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '28px Arial';
    ctx.fillText('INVITATION', 540, 280);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px "PingFang SC","Microsoft YaHei",sans-serif';
    wrapText(ctx, meta.title, 540, 400, 920, 72);

    ctx.font = '38px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(fmtRange(meta.date, meta.endDate), 540, 640);
    ctx.fillText(meta.venue, 540, 700);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '30px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(meta.city + ' · ' + meta.address, 540, 752);

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '34px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('尊敬的', 540, 880);
    ctx.fillStyle = '#f0b429';
    ctx.font = 'bold 96px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(reg.name, 540, 1000);

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '34px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('您的专属席位', 540, 1150);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(seat ? seat.seatNo : '待分配', 540, 1230);

    drawQR(ctx, 540, 1450, 300, location.href.split('#')[0]);

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '28px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('扫码进入会议微站', 540, 1660);
    if (meta.contact && meta.contact.wechat) {
      ctx.fillText('会务微信：' + meta.contact.wechat, 540, 1710);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '24px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('会议信息管理系统 · 自动生成', 540, 1820);
  }
  var inviteDl = document.getElementById('inviteDownload');
  if (inviteDl) inviteDl.addEventListener('click', function () {
    var cv = document.getElementById('inviteCanvas');
    try {
      var url = cv.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url;
      a.download = '邀请函_' + (lastMe ? lastMe.name : 'me') + '.png';
      a.click();
      toast('已开始下载');
    } catch (e) { toast('下载失败：' + e.message); }
  });

  /* 启动提醒调度器 */
  startReminderScheduler();

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
    document.querySelectorAll('.topnav a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      a.classList.toggle('active', href === '#' + current);
    });
    if (current === 'agenda' && !agendaTracked) { agendaTracked = true; S.track('agenda'); }
  }, { passive: true });

  /* ---------- 九宫格模块注入（v2.2） ---------- */
  /* 把后台配置的额外模块（system + custom 排除已硬编码的部分）追加到底部 Tab 链接。
   * system 模块的「#welcome / #org / #info / #agenda / #speakers / #live / #hotel / #contact」等
   * 锚点对应 hero/about/.../venue/live 等已有 section；reg/seat/me/openReg/openSeat/openMe 已经在 Tab 里。
   * 因此这里只注入：① system 模块里非硬编码的（#welcome / #org / #info / #live / #hotel / #contact）；
   *                  ② 所有 custom 模块。 */
  window.openCustomModule = function (id) {
    S.getModule(id).then(function (m) {
      if (!m) { toast('模块已不存在'); return; }
      var cfg = m.config || {};
      document.getElementById('customTitle').textContent = cfg.title || m.label;
      document.getElementById('customBody').textContent = cfg.body || (m.desc || '');
      var linkBox = document.getElementById('customLink');
      if (cfg.link) {
        linkBox.innerHTML = '<a class="btn" href="' + cfg.link + '" target="_blank" rel="noopener">' + (cfg.linkText || '了解更多') + '</a>';
      } else { linkBox.innerHTML = ''; }
      showMask('customMask');
    });
  };
  (async function injectExtraModules() {
    var box = document.getElementById('extraModules');
    if (!box) return;
    var tabbar = box.parentNode;
    var list = await S.listModules({ enabledOnly: true });
    var skip = { home: 1, agenda: 1, speakers: 1, venue: 1, me: 1, reg: 1, seat: 1, openReg: 1, openSeat: 1, openMe: 1 };
    list.forEach(function (m) {
      // 跳过已通过锚点/函数接入的 system 模块
      if (m.type === 'system' && skip[m.id]) return;
      var a = document.createElement('a');
      // custom 模块默认走弹层；system 模块用其 href
      if (m.type === 'custom') {
        a.setAttribute('href', 'javascript:openCustomModule(\'' + m.id + '\')');
      } else {
        a.setAttribute('href', m.href || '#');
        if ((m.href || '').charAt(0) === '#') a.setAttribute('data-tab', m.href.slice(1));
      }
      a.setAttribute('target', m.target || '_self');
      a.innerHTML = '<span class="ic">' + (m.icon || '🔗') + '</span>' + m.label;
      // 插到 box 之后、最后一个 a 之前
      tabbar.insertBefore(a, box);
    });
  })();

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
