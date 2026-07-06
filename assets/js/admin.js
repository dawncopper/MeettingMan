/* ============================================================
 * 会议信息管理系统 - 后台管理逻辑
 * ============================================================ */
(function () {
  'use strict';
  var S = window.ConfStore;
  S.ensureSeed();

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
    };
  });

  /* ---------- 基本信息 ---------- */
  var meta = S.getMeta();
  var mf = $('metaForm');
  ['title', 'enTitle', 'date', 'endDate', 'city', 'venue', 'address', 'theme', 'about'].forEach(function (k) {
    if (mf[k]) mf[k].value = meta[k] || '';
  });
  mf.phone.value = meta.contact.phone; mf.email.value = meta.contact.email; mf.wechat.value = meta.contact.wechat;
  mf.highlights.value = (meta.highlights || []).join('，');
  mf.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = {};
    ['title', 'enTitle', 'date', 'endDate', 'city', 'venue', 'address', 'theme', 'about'].forEach(function (k) { v[k] = mf[k].value.trim(); });
    v.contact = { phone: mf.phone.value.trim(), email: mf.email.value.trim(), wechat: mf.wechat.value.trim() };
    v.highlights = mf.highlights.value.split(/[，,]/).map(function (s) { return s.trim(); }).filter(Boolean);
    v.shortTitle = meta.shortTitle; v.slogan = meta.slogan; v.liveUrl = meta.liveUrl;
    S.setMeta(v);
    toast('基本信息已保存');
  });

  /* ---------- 嘉宾管理 ---------- */
  function renderSpeakers() {
    var body = $('speakerBody'); body.innerHTML = '';
    S.getSpeakers().forEach(function (sp) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + sp.name + '</td><td>' + sp.title + '</td><td>' + sp.org + '</td><td>' + (sp.topic || '') +
        '</td><td><span class="op" onclick="editSpeaker(\'' + sp.id + '\')">编辑</span><span class="op del" onclick="delSpeaker(\'' + sp.id + '\')">删除</span></td>';
      body.appendChild(tr);
    });
  }
  window.editSpeaker = function (id) {
    var list = S.getSpeakers();
    var sp = id ? list.filter(function (x) { return x.id === id; })[0] : null;
    $('spTitle').textContent = sp ? '编辑嘉宾' : '新增嘉宾';
    var f = $('spForm');
    f.id.value = sp ? sp.id : '';
    f.name.value = sp ? sp.name : '';
    f.title.value = sp ? sp.title : '';
    f.org.value = sp ? sp.org : '';
    f.topic.value = sp ? sp.topic : '';
    f.avatar.value = sp ? sp.avatar : '';
    f.color.value = sp ? sp.color : '#2f54eb';
    $('spMask').classList.add('show');
  };
  window.delSpeaker = function (id) {
    if (!confirm('确认删除该嘉宾？')) return;
    S.setSpeakers(S.getSpeakers().filter(function (x) { return x.id !== id; }));
    renderSpeakers(); toast('已删除');
  };
  $('spForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    var list = S.getSpeakers();
    var obj = { id: f.id.value || S.uid('s'), name: f.name.value.trim(), title: f.title.value.trim(),
      org: f.org.value.trim(), topic: f.topic.value.trim(), avatar: f.avatar.value.trim() || f.name.value.trim().slice(0, 1),
      color: f.color.value };
    if (f.id.value) {
      list = list.map(function (x) { return x.id === obj.id ? obj : x; });
    } else { list.push(obj); }
    S.setSpeakers(list);
    $('spMask').classList.remove('show');
    renderSpeakers(); toast('已保存');
  });

  /* ---------- 议程管理 ---------- */
  function renderAgenda() {
    var box = $('agendaAdmin'); box.innerHTML = '';
    var list = S.getAgenda();
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
    // 绑定输入即时保存
    [].forEach.call(box.querySelectorAll('input[data-k]'), function (inp) {
      inp.onchange = function () {
        var d = +inp.getAttribute('data-d'), s = +inp.getAttribute('data-s'), k = inp.getAttribute('data-k');
        var list = S.getAgenda();
        list[d].sessions[s][k] = inp.value;
        S.setAgenda(list);
      };
    });
  }
  window.addDay = function () {
    var list = S.getAgenda();
    list.push({ day: 'Day ' + (list.length + 1) + ' · 新日期', date: '', sessions: [] });
    S.setAgenda(list); renderAgenda(); toast('已新增日期');
  };
  window.delDay = function (i) {
    if (!confirm('确认删除当天全部议程？')) return;
    var list = S.getAgenda(); list.splice(i, 1); S.setAgenda(list); renderAgenda();
  };
  window.addSession = function (i) {
    var list = S.getAgenda();
    list[i].sessions.push({ time: '09:00-10:00', title: '新议程', speaker: '演讲人', type: 'keynote' });
    S.setAgenda(list); renderAgenda();
  };
  window.delSession = function (di, si) {
    var list = S.getAgenda(); list[di].sessions.splice(si, 1); S.setAgenda(list); renderAgenda();
  };

  /* ---------- 报名管理 ---------- */
  function renderRegs() {
    var body = $('regBody'); body.innerHTML = '';
    var list = S.getRegs();
    $('regEmpty').style.display = list.length ? 'none' : 'block';
    list.slice().reverse().forEach(function (r) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + r.name + '</td><td>' + r.phone + '</td><td>' + r.org + '</td><td>' + (r.ticket || '-') +
        '</td><td>' + (r.hotel || '-') + '</td><td>' + (r.time || '').slice(0, 16).replace('T', ' ') + '</td>' +
        '<td><span class="op del" onclick="delReg(\'' + r.id + '\')">删除</span></td>';
      body.appendChild(tr);
    });
  }
  window.delReg = function (id) {
    if (!confirm('确认删除该报名？')) return;
    S.removeReg(id); renderRegs(); toast('已删除');
  };
  window.exportRegs = function () {
    var list = S.getRegs();
    if (!list.length) { toast('暂无数据'); return; }
    var head = ['姓名', '手机', '单位', '职务', '票种', '住宿', '时间'];
    var rows = list.map(function (r) { return [r.name, r.phone, r.org, r.title || '', r.ticket || '', r.hotel || '', r.time || '']; });
    var csv = '﻿' + head.join(',') + '\n' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = '报名记录_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
    toast('已导出 ' + list.length + ' 条');
  };
  function csvCell(v) { v = (v == null ? '' : String(v)); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

  /* ---------- 座位管理 ---------- */
  function renderSeats() {
    var body = $('seatBody'); body.innerHTML = '';
    var seats = S.getSeats();
    var arr = Object.keys(seats).map(function (k) { return seats[k]; });
    $('seatEmpty').style.display = arr.length ? 'none' : 'block';
    arr.forEach(function (s) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + (s.name || '-') + '</td><td>' + (s.phone || '-') + '</td><td>' + s.seatNo + '</td><td>' + (s.zoneName || s.zone) + '</td>';
      body.appendChild(tr);
    });
  }

  renderSpeakers();
  renderAgenda();
  renderRegs();
  renderSeats();
})();
