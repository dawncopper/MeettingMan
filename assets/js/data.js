/* ============================================================
 * 会议信息管理系统 - 共享数据层
 * 数据持久化：localStorage
 * 说明：所有会议内容（基本信息 / 嘉宾 / 议程 / 报名 / 座位）均存于浏览器本地，
 *       可在后台 admin.html 中维护，适合微信微站与桌面浏览器演示使用。
 * ============================================================ */

(function (global) {
  'use strict';

  var KEYS = {
    conf: 'conf_meta',
    speakers: 'conf_speakers',
    agenda: 'conf_agenda',
    regs: 'conf_registrations',
    seats: 'conf_seats',
    materials: 'conf_materials'
  };

  /* ---------- 种子数据 ---------- */
  var SEED = {
    meta: {
      title: '2026 中国（深圳）国际数字经济发展大会',
      shortTitle: '数字经济大会 2026',
      enTitle: 'China (Shenzhen) Digital Economy Summit 2026',
      date: '2026-09-18',
      endDate: '2026-09-20',
      city: '深圳',
      venue: '深圳国际会展中心',
      address: '广东省深圳市宝安区福海街道展城路 1 号',
      theme: '智联万物 · 数启未来',
      slogan: '汇聚全球数字力量，共建产业新生态',
      about:
        '2026 中国（深圳）国际数字经济发展大会以“智联万物 · 数启未来”为主题，聚焦人工智能、数据要素、产业互联网与数字治理等前沿议题。大会汇聚政府主管部门、院士专家、龙头企业与投融资机构，通过主论坛、平行分论坛、成果发布与场景体验，搭建产学研用协同的高端交流平台，助力数字经济高质量发展。',
      highlights: [
        '30+ 院士与权威专家主旨分享',
        '100+ 龙头企业与独角兽参展',
        '5 大平行分论坛覆盖核心赛道',
        '重磅成果发布与精准对接会'
      ],
      organizers: ['主办单位：中国信息协会', '承办单位：深圳市数字经济发展促进会', '支持单位：深圳市工业和信息化局'],
      contact: { phone: '0755-88886666', email: 'summit@digital2026.cn', wechat: 'DigitalSummit2026' },
      liveUrl: ''
    },

    speakers: [
      { id: 's1', name: '李建国', title: '中国工程院院士', org: '清华大学', topic: '人工智能赋能新型工业化', avatar: '李', color: '#2f54eb' },
      { id: 's2', name: 'Wang Lei', title: '首席科学家', org: '某科技集团', topic: '大模型时代的产业落地', avatar: 'W', color: '#722ed1' },
      { id: 's3', name: '陈晓芸', title: '教授 / 博导', org: '中国科学院', topic: '数据要素市场化配置', avatar: '陈', color: '#13c2c2' },
      { id: 's4', name: '张明', title: 'CEO', org: '云启科技', topic: '产业互联网的下一站', avatar: '张', color: '#fa8c16' },
      { id: 's5', name: 'Sarah Chen', title: 'VP of AI', org: 'Global Tech', topic: 'Responsible AI at Scale', avatar: 'S', color: '#eb2f96' },
      { id: 's6', name: '刘洋', title: '研究院院长', org: '国家信息中心', topic: '数字治理与数据安全', avatar: '刘', color: '#2f54eb' }
    ],

    agenda: [
      {
        day: 'Day 1 · 9月18日',
        date: '2026-09-18',
        sessions: [
          { time: '09:00-09:30', title: '开幕式 & 领导致辞', speaker: '大会组委会', type: 'ceremony' },
          { time: '09:30-10:15', title: '主旨演讲：人工智能赋能新型工业化', speaker: '李建国', type: 'keynote' },
          { time: '10:30-11:15', title: '大模型时代的产业落地', speaker: 'Wang Lei', type: 'keynote' },
          { time: '11:15-12:00', title: '圆桌：数据要素的市场化之路', speaker: '多位嘉宾', type: 'roundtable' },
          { time: '14:00-17:30', title: '平行分论坛 A/B/C/D/E', speaker: '各分论坛', type: 'forum' }
        ]
      },
      {
        day: 'Day 2 · 9月19日',
        date: '2026-09-19',
        sessions: [
          { time: '09:00-09:45', title: '数据要素市场化配置', speaker: '陈晓芸', type: 'keynote' },
          { time: '09:45-10:30', title: '产业互联网的下一站', speaker: '张明', type: 'keynote' },
          { time: '10:45-11:30', title: 'Responsible AI at Scale', speaker: 'Sarah Chen', type: 'keynote' },
          { time: '14:00-16:00', title: '成果发布与场景体验', speaker: '组委会', type: 'release' },
          { time: '16:00-17:30', title: '投融资对接会', speaker: '投资机构', type: 'match' }
        ]
      },
      {
        day: 'Day 3 · 9月20日',
        date: '2026-09-20',
        sessions: [
          { time: '09:00-10:30', title: '数字治理与数据安全', speaker: '刘洋', type: 'keynote' },
          { time: '10:45-12:00', title: '闭幕式 & 总结', speaker: '大会组委会', type: 'ceremony' }
        ]
      }
    ],

    materials: [
      { id: 'm1', name: '大会官方手册（PDF）', size: '4.2 MB', tag: '手册' },
      { id: 'm2', name: '主论坛演讲PPT合集', size: '18.6 MB', tag: 'PPT' },
      { id: 'm3', name: '展商名录与展位图', size: '2.1 MB', tag: '名录' },
      { id: 'm4', name: '深圳市数字产业政策汇编', size: '3.5 MB', tag: '政策' }
    ]
  };

  /* ---------- 存储工具 ---------- */
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      return false;
    }
  }
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* 首次访问写入种子数据（仅当对应键不存在） */
  function ensureSeed() {
    if (!localStorage.getItem(KEYS.conf)) write(KEYS.conf, SEED.meta);
    if (!localStorage.getItem(KEYS.speakers)) write(KEYS.speakers, SEED.speakers);
    if (!localStorage.getItem(KEYS.agenda)) write(KEYS.agenda, SEED.agenda);
    if (!localStorage.getItem(KEYS.materials)) write(KEYS.materials, SEED.materials);
    if (localStorage.getItem(KEYS.regs) === null) write(KEYS.regs, []);
    // 座位在首次查询/报名时按需生成
  }

  /* ---------- 业务接口 ---------- */
  var API = {
    KEYS: KEYS,
    uid: uid,
    ensureSeed: ensureSeed,

    getMeta: function () { return read(KEYS.conf, SEED.meta); },
    setMeta: function (m) { return write(KEYS.conf, m); },

    getSpeakers: function () { return read(KEYS.speakers, SEED.speakers); },
    setSpeakers: function (list) { return write(KEYS.speakers, list); },

    getAgenda: function () { return read(KEYS.agenda, SEED.agenda); },
    setAgenda: function (list) { return write(KEYS.agenda, list); },

    getMaterials: function () { return read(KEYS.materials, SEED.materials); },
    setMaterials: function (list) { return write(KEYS.materials, list); },

    getRegs: function () { return read(KEYS.regs, []); },
    addReg: function (reg) {
      var list = read(KEYS.regs, []);
      reg.id = uid('reg');
      reg.time = new Date().toISOString();
      list.push(reg);
      write(KEYS.regs, list);
      return reg;
    },
    removeReg: function (id) {
      var list = read(KEYS.regs, []).filter(function (r) { return r.id !== id; });
      write(KEYS.regs, list);
      return list;
    },

    /* 座位：以 姓名+手机 为键。若已分配则返回，否则自动分配一个空位。 */
    getSeats: function () { return read(KEYS.seats, {}); },
    setSeats: function (map) { return write(KEYS.seats, map); },
    findSeat: function (name, phone) {
      var seats = this.getSeats();
      var key = (name || '').trim() + '|' + (phone || '').trim();
      if (seats[key]) return seats[key];
      // 自动分配
      var seat = assignSeat(seats);
      if (seat) {
        seat.name = (name || '').trim();
        seat.phone = (phone || '').trim();
        seats[key] = seat;
        this.setSeats(seats);
      }
      return seat;
    }
  };

  /* 座位规划：A/B/C 三个区，每区 10 排，每排 12 座 */
  var ZONES = [
    { code: 'A', name: 'A 区 · 主会场前区', rows: 10, cols: 12 },
    { code: 'B', name: 'B 区 · 主会场中区', rows: 10, cols: 12 },
    { code: 'C', name: 'C 区 · 主会场后区', rows: 8, cols: 12 }
  ];

  function assignSeat(seats) {
    // 收集已占用坐标
    var taken = {};
    Object.keys(seats).forEach(function (k) {
      var s = seats[k];
      taken[s.zone + '-' + s.row + '-' + s.col] = true;
    });
    // 优先填满 A 区
    for (var z = 0; z < ZONES.length; z++) {
      var zone = ZONES[z];
      for (var r = 1; r <= zone.rows; r++) {
        for (var c = 1; c <= zone.cols; c++) {
          if (!taken[zone.code + '-' + r + '-' + c]) {
            return { zone: zone.code, zoneName: zone.name, row: r, col: c, seatNo: zone.code + String(r).padStart(2, '0') + '排' + String(c).padStart(2, '0') + '座' };
          }
        }
      }
    }
    return null; // 满座
  }

  API.ZONES = ZONES;
  API.assignSeat = assignSeat;

  global.ConfStore = API;
})(window);
