/* ============================================================
 * 会议信息管理系统 - 共享数据层 v2（抽象层）
 * ------------------------------------------------------------
 * 设计目标（见 docs/ARCHITECTURE-REVIEW.md）：
 *   - 所有数据访问统一走 ConfStore 的 async API；
 *   - 存储介质通过「适配器(Adapter)」解耦：
 *       LocalAdapter  -> 浏览器 localStorage（当前 v1/v1.5 使用）
 *       HttpAdapter   -> 未来对接 NestJS BFF（v2 切换，调用方 0 改动）
 *   - 切换后端只需 window.ConfStore.setAdapter(new HttpAdapter(baseUrl))。
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 适配器接口 ----------
   * 任何适配器需实现：get(key):any|null / set(key,val):bool / remove(key):bool
   * 适配器内部同步或异步均可，ConfStore 的公共方法统一以 Promise 形式返回。
   */

  // 当前实现：localStorage
  function LocalAdapter() { this.name = 'local'; }
  LocalAdapter.prototype.get = function (key) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  };
  LocalAdapter.prototype.set = function (key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  };
  LocalAdapter.prototype.remove = function (key) {
    try { localStorage.removeItem(key); return true; } catch (e) { return false; }
  };

  /* ---------- 未来实现（示意，v2 启用） ----------
   * function HttpAdapter(baseUrl, fetchImpl) {
   *   this.name = 'http'; this.base = baseUrl; this._f = fetchImpl || fetch;
   * }
   * HttpAdapter.prototype.get = function (key) {
   *   return this._f(this.base + '/kv/' + key).then(r => r.ok ? r.json() : null);
   * };
   * HttpAdapter.prototype.set = function (key, val) {
   *   return this._f(this.base + '/kv/' + key, {method:'PUT', body: JSON.stringify(val)}).then(r => r.ok);
   * };
   * HttpAdapter.prototype.remove = function (key) {
   *   return this._f(this.base + '/kv/' + key, {method:'DELETE'}).then(r => r.ok);
   * };
   */

  /* ---------- 存储 KEY 规划 ---------- */
  var KEYS = {
    conf: 'conf_meta',
    speakers: 'conf_speakers',
    agenda: 'conf_agenda',
    regs: 'conf_registrations',
    seats: 'conf_seats',
    materials: 'conf_materials',
    // v2 新增（仍走 localStorage；v2 切后端时由 HttpAdapter 接管，调用方 0 改动）
    stats: 'conf_stats',      // 微站访问统计（P0-5）
    notif: 'conf_notif',      // 用户提醒偏好（P0-4）：{ 'name|phone': {enabled, beforeMin, last:{...}} }
    client: 'conf_clientid',  // 设备指纹（粗略 UV）
    theme: 'conf_theme',      // 当前微站主题 key（如 'default' / 'light-academic'）
    modules: 'conf_modules',  // 九宫格模块列表（v2.2）
    // v2.3 多会议：
    meetings: 'conf_meetings',          // [{id, dir, name, slug, summary, lang, status, createdAt, meta, modules, theme}]
    currentMeeting: 'conf_current_meeting' // 当前会议 id
  };

  /* ---------- 主题库（v2.3 → v2.6 升级）
   *  - group：分类（科技/学术/政企/生活/儿童/极简）
   *  - preview：CSS 渐变字符串，缩略图背景
   *  - brand/brand2：覆盖 :root 的 --brand / --brand-2 CSS 变量（最低成本换色）
   *  - css/js：可空；非空时 site.js 会动态加载该主题的样式与脚本
   * ============================================================ */
  var THEMES = [
    { key: 'default',        name: '默认版',     group: '科技', preview: 'linear-gradient(135deg, #1d2b6b, #2f54eb)', desc: '科技蓝大 hero + 倒计时 + 6 大数据概览', emoji: '🏙️',
      brand: '#2f54eb', brand2: '#722ed1', css: '', js: '' },
    { key: 'tech-dark',      name: '深色科技',   group: '科技', preview: 'linear-gradient(135deg, #0a0e1c, #2f54eb)', desc: '深色科技蓝 + 投影场景', emoji: '🛸',
      brand: '#1654d6', brand2: '#00b8d9', css: '', js: '' },
    { key: 'light-academic', name: '轻量学术',   group: '学术', preview: 'linear-gradient(135deg, #1d2b6b, #722ed1)', desc: '全屏背景 + 9 宫格图标菜单（智会行兼容）', emoji: '🎓',
      brand: '#1d2b6b', brand2: '#722ed1', css: 'docs/themes/light-academic/theme.css', js: 'docs/themes/light-academic/theme.js' },
    { key: 'warm-corp',      name: '暖色政企',   group: '政企', preview: 'linear-gradient(135deg, #fa541c, #f0b429)', desc: '暖橙政企风 + 大气稳重型', emoji: '🏛️',
      brand: '#fa541c', brand2: '#f0b429', css: '', js: '' },
    { key: 'fresh-life',     name: '清新生活',   group: '生活', preview: 'linear-gradient(135deg, #13c2c2, #52c41a)', desc: '清新生活类 + 圆润色块', emoji: '🌿',
      brand: '#13c2c2', brand2: '#52c41a', css: '', js: '' },
    { key: 'kids',           name: '儿童活动',   group: '儿童', preview: 'linear-gradient(135deg, #eb2f96, #fa8c16)', desc: '糖果色卡通风', emoji: '🎈',
      brand: '#eb2f96', brand2: '#fa8c16', css: '', js: '' },
    { key: 'minimal',        name: '极简黑白',   group: '极简', preview: 'linear-gradient(135deg, #14182b, #4a5070)', desc: '极简黑白灰 + 高对比', emoji: '◼️',
      brand: '#14182b', brand2: '#4a5070', css: '', js: '' }
  ];

  /* ---------- Emoji 图标库（v2.3）----------
   * group：分类（基础/活动/工具/商务/教育/科技/生活/儿童）
   * name：中文标签
   * items：emoji 字符列表
   */
  var EMOJI_LIBRARY = [
    { group: '基础', name: '通用', items: ['📌','📍','📎','🔗','⭐','❤️','🔥','✨','💎','🎯','🚀','⚡','🌟','💡','📢','📣','🔔'] },
    { group: '活动', name: '活动', items: ['🎉','🎊','🎁','🎈','🏆','🥇','🥈','🥉','🎖️','🏅','🎗️','🎟️','🎫','🎪','🎭','🎨','🎬'] },
    { group: '工具', name: '工具', items: ['🛠️','🔧','🔨','⚙️','🧰','📐','📏','🔍','🔎','🔬','🔭','📡','🧪','💊','🩺','🩹','💉'] },
    { group: '商务', name: '商务', items: ['💼','📊','📈','📉','💹','💰','💵','💳','🏦','🏢','🏛️','📋','📑','📂','📁','🗂️','✏️'] },
    { group: '教育', name: '教育', items: ['🎓','📚','📖','📕','📗','📘','📙','📓','📔','✏️','✒️','🖊️','🖍️','📝','🗒️','📜','🎒'] },
    { group: '科技', name: '科技', items: ['💻','🖥️','🖱️','⌨️','📱','☎️','📞','🤖','🛸','🛰️','🧠','🧬','🧮','📡','🔋','🔌','💾'] },
    { group: '生活', name: '生活', items: ['🍴','🍽️','☕','🍵','🥗','🍎','🥐','🍞','🏨','🛏️','🚗','🚌','🚇','✈️','🚄','🗺️','🏙️'] },
    { group: '儿童', name: '儿童', items: ['🎈','🎨','🧸','🪀','🪁','🎠','🎡','🎢','🎪','🎁','🍭','🍬','🍦','🍩','🍪','🧁','🧃'] },
    { group: '会议', name: '会议专属', items: ['👋','🏛️','📌','📅','✍️','💺','👤','🎥','🏨','☎️','🪑','📍','🎤','🎙️','📺','📽️','🧾'] },
    { group: '状态', name: '状态', items: ['✅','❌','⚠️','❓','❗','💬','📩','✉️','📧','📞','📲','🤝','🙏','👀','👥','👨‍👩‍👧','👨‍💼'] }
  ];

  /* ---------- 系统模块注册表 ----------
   * 9 个内置模块，绑定到站内已有 section / 弹层 / 业务能力
   * type='system' 的不可删，可 disable；type='custom' 主办方可任意 CRUD
   */
  var SYSTEM_MODULES = [
    { id: 'welcome',  type: 'system', label: '欢迎辞',   icon: '👋', href: '#welcome',  desc: '会议欢迎辞（基本信息）' },
    { id: 'org',      type: 'system', label: '组织架构', icon: '🏛️', href: '#org',      desc: '组织架构（主办/承办/支持单位）' },
    { id: 'info',     type: 'system', label: '会议信息', icon: '📌', href: '#info',     desc: '会议信息（时间地点主题）' },
    { id: 'agenda',   type: 'system', label: '会议日程', icon: '📅', href: '#agenda',   desc: '大会议程（日切换）' },
    { id: 'speakers', type: 'system', label: '嘉宾介绍', icon: '🌟', href: '#speakers', desc: '嘉宾阵容' },
    { id: 'reg',      type: 'system', label: '会议报名', icon: '✍️', href: 'javascript:openReg()', desc: '个人/团队报名', primary: true },
    { id: 'seat',     type: 'system', label: '座位查询', icon: '💺', href: 'javascript:openSeat()', desc: '查询专属座位' },
    { id: 'me',       type: 'system', label: '我的参会', icon: '👤', href: 'javascript:openMe()', desc: '个人中心（座位/团队/邀请函）' },
    { id: 'live',     type: 'system', label: '会议直播', icon: '🎥', href: '#live',     desc: '会议直播' },
    { id: 'hotel',    type: 'system', label: '预定酒店', icon: '🏨', href: '#hotel',    desc: '预定酒店（P1 待接入）' },
    { id: 'contact',  type: 'system', label: '联系我们', icon: '☎️', href: '#contact',  desc: '会务联系方式' },
    { id: 'invite',   type: 'system', label: '邀请函',   icon: '✉️', href: 'javascript:openInvite()', desc: '生成专属邀请函（PNG）' },
    { id: 'materials',type: 'system', label: '会议资料', icon: '📚', href: '#materials',desc: '资料下载' }
  ];

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
      liveUrl: '',
      // v2.3 新增：会议视觉资产
      logo: '',         // 顶部 logo 图（base64 或 http URL）
      bgImage: '',      // 全屏背景图（base64 或 http URL）
      bgColor: '',      // 主色（#rrggbb），可与渐变并存
      liveTitle: '大会主论坛直播',
      liveState: '直播即将开启'
    },

    speakers: [
      { id: 's1', name: '李建国', title: '中国工程院院士', org: '清华大学', topic: '人工智能赋能新型工业化', avatar: '李', color: '#2f54eb', photo: '' },
      { id: 's2', name: 'Wang Lei', title: '首席科学家', org: '某科技集团', topic: '大模型时代的产业落地', avatar: 'W', color: '#722ed1', photo: '' },
      { id: 's3', name: '陈晓芸', title: '教授 / 博导', org: '中国科学院', topic: '数据要素市场化配置', avatar: '陈', color: '#13c2c2', photo: '' },
      { id: 's4', name: '张明', title: 'CEO', org: '云启科技', topic: '产业互联网的下一站', avatar: '张', color: '#fa8c16', photo: '' },
      { id: 's5', name: 'Sarah Chen', title: 'VP of AI', org: 'Global Tech', topic: 'Responsible AI at Scale', avatar: 'S', color: '#eb2f96', photo: '' },
      { id: 's6', name: '刘洋', title: '研究院院长', org: '国家信息中心', topic: '数字治理与数据安全', avatar: '刘', color: '#2f54eb', photo: '' }
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

  /* ---------- 内部状态 ---------- */
  var adapter = new LocalAdapter();

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* 默认模块列表 = 系统模块的有序副本（带 enabled/order 字段） */
  function buildDefaultModules() {
    return SYSTEM_MODULES.map(function (m, i) {
      return {
        id: m.id, type: 'system', label: m.label, icon: m.icon,
        href: m.href, desc: m.desc, primary: !!m.primary,
        enabled: true, order: i,
        config: null  // 自定义模块放 config：{title, body, link}
      };
    });
  }

  /* 座位规划：A/B/C 三个区，每区多排多座 */
  var ZONES = [
    { code: 'A', name: 'A 区 · 主会场前区', rows: 10, cols: 12 },
    { code: 'B', name: 'B 区 · 主会场中区', rows: 10, cols: 12 },
    { code: 'C', name: 'C 区 · 主会场后区', rows: 8, cols: 12 }
  ];

  function assignSeat(seats) {
    var taken = {};
    Object.keys(seats).forEach(function (k) {
      var s = seats[k];
      taken[s.zone + '-' + s.row + '-' + s.col] = true;
    });
    for (var z = 0; z < ZONES.length; z++) {
      var zone = ZONES[z];
      for (var r = 1; r <= zone.rows; r++) {
        for (var c = 1; c <= zone.cols; c++) {
          if (!taken[zone.code + '-' + r + '-' + c]) {
            return {
              zone: zone.code, zoneName: zone.name, row: r, col: c,
              seatNo: zone.code + String(r).padStart(2, '0') + '排' + String(c).padStart(2, '0') + '座'
            };
          }
        }
      }
    }
    return null;
  }

  /* ---------- 会议实体（v2.3 → v2.4 完整数据） ---------- */
  function buildDefaultMeeting() {
    return {
      id: 'm_default',
      dir: 'default',
      name: SEED.meta.title,
      slug: 'default',
      summary: SEED.meta.about.slice(0, 80),
      lang: 'zh-CN',
      status: 'draft',
      createdAt: new Date().toISOString(),
      meta: JSON.parse(JSON.stringify(SEED.meta)),
      speakers: JSON.parse(JSON.stringify(SEED.speakers)),
      agenda:   JSON.parse(JSON.stringify(SEED.agenda)),
      materials: JSON.parse(JSON.stringify(SEED.materials)),
      modules: buildDefaultModules(),
      theme: 'default'
    };
  }
  function listMeetingsFromStore() {
    return adapter.get(KEYS.meetings) || [buildDefaultMeeting()];
  }
  function findMeeting(idOrSlug) {
    var list = listMeetingsFromStore();
    return list.filter(function (m) { return m.id === idOrSlug || m.slug === idOrSlug; })[0] || null;
  }

  /* v2.10.3：read-time merge SYSTEM_MODULES
   * 老用户（v2.10.2 之前建的）会议里 m.modules 字段冻结在 11 项，
   * 永远升不到 13。读时检查：缺哪个系统模块就补哪个（保留用户 enabled/order 状态），
   * 持久化一次后下次直接走原路径。 */
  function mergeSystemModules(list) {
    var systemIds = SYSTEM_MODULES.map(function (m) { return m.id; });
    var presentIds = {};
    list.forEach(function (m) { if (m && m.id) presentIds[m.id] = true; });
    var maxOrder = list.reduce(function (mx, mm) { return Math.max(mx, mm.order || 0); }, 0);
    var added = false;
    SYSTEM_MODULES.forEach(function (sm) {
      if (!presentIds[sm.id]) {
        // 不覆盖已有项；缺哪个补哪个；order 续在最后
        list.push(Object.assign({}, sm, { order: ++maxOrder }));
        added = true;
      }
    });
    if (added) {
      // 持久化：把补齐后的 m.modules 写回
      var cur = (adapter.get(KEYS.currentMeeting) || '');
      var all = listMeetingsFromStore().map(function (mm) {
        if (mm.id === cur) {
          mm.modules = list.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        }
        return mm;
      });
      adapter.set(KEYS.meetings, all);
    }
    return list;
  }

  /* ---------- 会议级数据 key（v2.4）----------
   * 每个会议独立的 regs / seats / stats：
   *   命名规则：conf_mtg_<meetingId>_<kind>
   * 旧版全局 key（conf_regs/conf_seats/conf_stats）自动迁移到默认会议 m_default */
  function mtgKey(meetingId, kind) { return 'conf_mtg_' + meetingId + '_' + kind; }
  var LEGACY_KEYS = {
    regs:  KEYS.regs,  // 'conf_regs'
    seats: KEYS.seats, // 'conf_seats'
    stats: KEYS.stats  // 'conf_stats'
  };
  function mtgGet(meetingId, kind, defaultVal) {
    var k = mtgKey(meetingId, kind);
    var v = adapter.get(k);
    // v2.4：默认会议优先从老全局 key 读取（仅首次迁移）
    if (meetingId === 'm_default' && LEGACY_KEYS[kind] !== undefined) {
      var lv = adapter.get(LEGACY_KEYS[kind]);
      if (lv !== null && lv !== undefined) {
        if (v === null || v === undefined) {
          adapter.set(k, lv);   // 落到新 key
          return lv;
        }
      }
    }
    if (v === null || v === undefined) {
      v = (defaultVal !== undefined) ? defaultVal :
         (kind === 'stats' ? { pv: 0, uv: 0, clients: {}, actions: {}, pagePV: {}, daily: {} } : (kind === 'seats' ? {} : []));
      adapter.set(k, v);
    }
    return v;
  }
  function mtgSet(meetingId, kind, val) { adapter.set(mtgKey(meetingId, kind), val); }
  function mtgReset(meetingId) {
    adapter.set(mtgKey(meetingId, 'regs'),  []);
    adapter.set(mtgKey(meetingId, 'seats'), {});
    adapter.set(mtgKey(meetingId, 'stats'), { pv: 0, uv: 0, clients: {}, actions: {}, pagePV: {}, daily: {} });
  }

  /* v2.10：老会议 shortTitle 同步 meeting.name
   * 触发条件：
   *  - 不是默认会议（m_default）
   *  - meta.shortTitle 是 SEED 默认值（"数字经济大会 2026"）——说明是 v2.9 之前建的
   *  - meeting.name 已被用户设置 */
  function migrateOldMeetingsShortTitle() {
    var SEED_SHORT = SEED.meta.shortTitle;
    var list = listMeetingsFromStore();
    var dirty = false;
    list.forEach(function (m) {
      if (!m || m.id === 'm_default') return; // 跳过默认会议
      if (m.meta && m.name && m.meta.shortTitle === SEED_SHORT && m.name !== SEED_SHORT) {
        m.meta.shortTitle = m.name;
        if (!m.meta.title || m.meta.title === SEED.meta.title) m.meta.title = m.name;
        dirty = true;
      }
    });
    if (dirty) adapter.set(KEYS.meetings, list);
  }

  /* ---------- 公共 async API ---------- */
  var API = {
    KEYS: KEYS,
    ZONES: ZONES,
    uid: uid,
    adapterName: 'local',

    /* 切换存储适配器（v2 切后端用，调用方代码不变） */
    setAdapter: function (a) { adapter = a; this.adapterName = a ? a.name : 'local'; },

    /* 初始化：首次访问写入种子数据 + 迁移旧结构到默认会议（v2.3→v2.4） */
    init: function () {
      // 1) 兼容老结构：直接落库的 conf/speakers/agenda/materials/theme/modules
      if (!adapter.get(KEYS.conf)) adapter.set(KEYS.conf, SEED.meta);
      if (!adapter.get(KEYS.speakers)) adapter.set(KEYS.speakers, SEED.speakers);
      if (!adapter.get(KEYS.agenda)) adapter.set(KEYS.agenda, SEED.agenda);
      if (!adapter.get(KEYS.materials)) adapter.set(KEYS.materials, SEED.materials);
      if (adapter.get(KEYS.regs) === null) adapter.set(KEYS.regs, []);
      if (!adapter.get(KEYS.client)) adapter.set(KEYS.client, 'c_' + uid(''));
      if (!adapter.get(KEYS.theme)) adapter.set(KEYS.theme, 'default');
      if (!adapter.get(KEYS.modules)) adapter.set(KEYS.modules, buildDefaultModules());

      // 2) 多会议：检测老结构 → 自动迁移为默认会议
      var legacyMeta = adapter.get(KEYS.conf);
      var existingMeetings = adapter.get(KEYS.meetings);
      if (!existingMeetings) {
        var m = buildDefaultMeeting();
        // v2.4：老数据优先（覆盖 SEED 默认）
        m.meta = legacyMeta || SEED.meta;
        m.modules = adapter.get(KEYS.modules) || buildDefaultModules();
        m.theme = adapter.get(KEYS.theme) || 'default';
        m.speakers = adapter.get(KEYS.speakers) || SEED.speakers;
        m.agenda   = adapter.get(KEYS.agenda)   || SEED.agenda;
        m.materials = adapter.get(KEYS.materials) || SEED.materials;
        // 报告/通知/统计是全局的（不分会议）
        adapter.set(KEYS.meetings, [m]);
        adapter.set(KEYS.currentMeeting, m.id);
      } else if (!adapter.get(KEYS.currentMeeting)) {
        adapter.set(KEYS.currentMeeting, existingMeetings[0].id);
      }
      // 2.5) v2.4：触发默认会议 regs/seats/stats 迁移（mtgGet 内部一次性搬迁）
      // 注意：仅对"非默认会议"预热空数据；默认会议有 legacy 迁移，要按需懒加载
      return this.getCurrentMeeting().then(function (cur) {
        if (cur) {
          if (cur.id !== 'm_default') {
            mtgReset(cur.id);
          }
          // 默认会议：让 mtgGet 在真正被 getRegs/getSeats/getStats 调用时再触发 legacy
        }
        // 2.6) v2.10：老会议 shortTitle 自动迁移
        // 历史会议（v2.9 之前建的）meta.shortTitle 还是 SEED 默认值（"数字经济大会 2026"），
        // 启动时检测并同步成 meeting.name，存盘
        migrateOldMeetingsShortTitle();
      });
    },

    /* ---------- 访问统计（P0-5 → v2.4 按会议隔离） ---------- */
    /* 设备指纹仍然全局（同一台浏览器跨会议共享） */
    getClientId: function () {
      var id = adapter.get(KEYS.client);
      if (!id) { id = 'c_' + uid(''); adapter.set(KEYS.client, id); }
      return Promise.resolve(id);
    },
    /* 读取当前会议统计对象（缺省初始化） */
    getStats: function () {
      return this.getCurrentMeeting().then(function (m) {
        if (!m) return { pv: 0, uv: 0, clients: {}, actions: {}, pagePV: {}, daily: {} };
        return mtgGet(m.id, 'stats', { pv: 0, uv: 0, clients: {}, actions: {}, pagePV: {}, daily: {} });
      });
    },
    /* 埋点：event ∈ {visit, reg, seat, invite, agenda} — 累加当前会议统计 */
    track: function (event, path) {
      return Promise.all([this.getClientId(), this.getCurrentMeeting()]).then(function (res) {
        var cid = res[0], m = res[1];
        if (!m) return null;
        var s = mtgGet(m.id, 'stats', { pv: 0, uv: 0, clients: {}, actions: {}, pagePV: {}, daily: {} });
        var today = new Date().toISOString().slice(0, 10);
        s.pv = (s.pv || 0) + 1;
        s.clients = s.clients || {};
        var isNew = !s.clients[cid];
        if (isNew) { s.clients[cid] = 1; s.uv = (s.uv || 0) + 1; }
        s.actions = s.actions || {};
        s.actions[event] = (s.actions[event] || 0) + 1;
        s.pagePV = s.pagePV || {};
        var p = path || event;
        s.pagePV[p] = (s.pagePV[p] || 0) + 1;
        s.daily = s.daily || {};
        if (!s.daily[today]) s.daily[today] = { pv: 0, uv: 0 };
        s.daily[today].pv++;
        if (isNew) s.daily[today].uv++;
        mtgSet(m.id, 'stats', s);
        return s;
      });
    },

    /* ---------- 提醒偏好（P0-4） ---------- */
    getNotif: function (key) {
      var m = adapter.get(KEYS.notif) || {};
      return Promise.resolve(m[key] || null);
    },
    setNotif: function (key, val) {
      var m = adapter.get(KEYS.notif) || {};
      m[key] = val;
      adapter.set(KEYS.notif, m);
      return Promise.resolve(val);
    },

    /* 基本信息 */
    getMeta: function () { return Promise.resolve(adapter.get(KEYS.conf) || SEED.meta); },
    /* 基本信息（v2.3：读写当前会议的 meta） */
    getMeta: function () { return this.getCurrentMeeting().then(function (m) { return (m && m.meta) || SEED.meta; }); },
    setMeta: function (patch) {
      return this.getCurrentMeeting().then(function (m) {
        m.meta = Object.assign({}, m.meta, patch);
        var list = listMeetingsFromStore().map(function (x) { return x.id === m.id ? m : x; });
        adapter.set(KEYS.meetings, list);
        return m.meta;
      });
    },

    /* 嘉宾（v2.3：读写当前会议的 speakers） */
    getSpeakers: function () { return this.getCurrentMeeting().then(function (m) { return (m && m.speakers) || SEED.speakers; }); },
    setSpeakers: function (list) {
      return this.getCurrentMeeting().then(function (m) {
        m.speakers = list;
        var all = listMeetingsFromStore().map(function (x) { return x.id === m.id ? m : x; });
        adapter.set(KEYS.meetings, all);
        return list;
      });
    },

    /* 议程（v2.3：读写当前会议的 agenda） */
    getAgenda: function () { return this.getCurrentMeeting().then(function (m) { return (m && m.agenda) || SEED.agenda; }); },
    setAgenda: function (list) {
      return this.getCurrentMeeting().then(function (m) {
        m.agenda = list;
        var all = listMeetingsFromStore().map(function (x) { return x.id === m.id ? m : x; });
        adapter.set(KEYS.meetings, all);
        return list;
      });
    },

    /* 资料（v2.3：读写当前会议的 materials） */
    getMaterials: function () { return this.getCurrentMeeting().then(function (m) { return (m && m.materials) || SEED.materials; }); },
    setMaterials: function (list) {
      return this.getCurrentMeeting().then(function (m) {
        m.materials = list;
        var all = listMeetingsFromStore().map(function (x) { return x.id === m.id ? m : x; });
        adapter.set(KEYS.meetings, all);
        return list;
      });
    },

    /* 报名（v2.4：按当前会议隔离） */
    getRegs: function () {
      return this.getCurrentMeeting().then(function (m) {
        if (!m) return [];
        return mtgGet(m.id, 'regs', []);
      });
    },
    addReg: function (reg) {
      var self = this;
      return this.getCurrentMeeting().then(function (m) {
        if (!m) return Promise.reject(new Error('无当前会议'));
        var list = mtgGet(m.id, 'regs', []);
        reg.id = uid('reg');
        reg.time = new Date().toISOString();
        reg.meetingId = m.id;
        list.push(reg);
        mtgSet(m.id, 'regs', list);
        return reg;
      });
    },
    addTeamRegs: function (regs) {
      var self = this;
      return this.getCurrentMeeting().then(function (m) {
        if (!m) return Promise.reject(new Error('无当前会议'));
        var list = mtgGet(m.id, 'regs', []);
        regs.forEach(function (r) {
          r.id = uid('reg');
          r.time = new Date().toISOString();
          r.meetingId = m.id;
          list.push(r);
        });
        mtgSet(m.id, 'regs', list);
        return regs;
      });
    },
    removeReg: function (id) {
      var self = this;
      return this.getCurrentMeeting().then(function (m) {
        if (!m) return [];
        var list = mtgGet(m.id, 'regs', []);
        var next = list.filter(function (r) { return r.id !== id; });
        mtgSet(m.id, 'regs', next);
        return next;
      });
    },
    /* 按 姓名+手机 查询单个报名（个人中心用） */
    getMyReg: function (name, phone) {
      return this.getCurrentMeeting().then(function (m) {
        if (!m) return null;
        var list = mtgGet(m.id, 'regs', []);
        var n = (name || '').trim(), p = (phone || '').trim();
        return list.filter(function (r) { return r.name === n && r.phone === p; })[0] || null;
      });
    },
    /* 按 teamId 聚合团队成员（团队管理用） */
    getRegsByTeam: function (teamId) {
      return this.getCurrentMeeting().then(function (m) {
        if (!m) return [];
        var list = mtgGet(m.id, 'regs', []);
        return list.filter(function (r) { return r.teamId === teamId; });
      });
    },

    /* 座位（v2.4：按当前会议隔离）
     * 键：姓名|手机（会议内唯一） */
    getSeats: function () {
      return this.getCurrentMeeting().then(function (m) {
        if (!m) return {};
        return mtgGet(m.id, 'seats', {});
      });
    },
    setSeats: function (map) {
      var self = this;
      return this.getCurrentMeeting().then(function (m) {
        if (!m) return map;
        mtgSet(m.id, 'seats', map);
        return map;
      });
    },
    findSeat: function (name, phone) {
      var self = this;
      return this.getCurrentMeeting().then(function (m) {
        if (!m) return null;
        var seats = mtgGet(m.id, 'seats', {});
        var key = (name || '').trim() + '|' + (phone || '').trim();
        if (seats[key]) return seats[key];
        var seat = assignSeat(seats);
        if (seat) {
          seat.name = (name || '').trim();
          seat.phone = (phone || '').trim();
          seat.meetingId = m.id;
          seats[key] = seat;
          mtgSet(m.id, 'seats', seats);
        }
        return seat;
      });
    },

    /* ---------- 主题（v2.1 新增） ---------- */
    /* 列出所有可用主题（不可变副本，避免调用方修改注册表） */
    listThemes: function () {
      return Promise.resolve(THEMES.map(function (t) { return { key: t.key, name: t.name, desc: t.desc, emoji: t.emoji }; }));
    },
    /* 读取当前主题 key（如 'default'） */
    getTheme: function () {
      var k = adapter.get(KEYS.theme);
      // 校验：必须能在注册表里找到
      if (k && THEMES.some(function (t) { return t.key === k; })) return Promise.resolve(k);
      return Promise.resolve('default');
    },
    /* 切换主题（落库 + 返回新 key） */
    setTheme: function (key) {
      if (!THEMES.some(function (t) { return t.key === key; })) {
        return Promise.reject(new Error('未知主题：' + key));
      }
      adapter.set(KEYS.theme, key);
      return Promise.resolve(key);
    },

    /* ---------- 九宫格模块（v2.2 → v2.3：走当前会议；v2.10.2：加 keepDisabled；v2.10.3：read-time merge） ---------- */
    listModules: function (opts) {
      opts = opts || {};
      return this.getCurrentMeeting().then(function (m) {
        if (!m) return [];
        // v2.10.3：read-time merge SYSTEM_MODULES
        // 老用户（v2.10.2 之前建的）会议里 m.modules 冻结在 11/12 项，永远升不到 13。
        // 每次读取时：缺哪个系统模块就补哪个（保留用户的 enabled/order 状态），持久化一次。
        var list = m.modules || [];
        list = mergeSystemModules(list);
        list = list.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        if (opts.enabledOnly && !opts.keepDisabled) {
          list = list.filter(function (mm) { return mm.enabled !== false; });
        }
        return list;
      });
    },
    getModule: function (id) {
      return this.getCurrentMeeting().then(function (m) {
        var list = (m && m.modules) || buildDefaultModules();
        return list.filter(function (x) { return x.id === id; })[0] || null;
      });
    },
    addModule: function (data) {
      if (!data || !data.label) return Promise.reject(new Error('模块名必填'));
      return this.getCurrentMeeting().then(function (m) {
        var list = (m && m.modules) || buildDefaultModules();
        var order = list.reduce(function (mx, mm) { return Math.max(mx, mm.order || 0); }, 0) + 1;
        var mod = {
          id: uid('mod'),
          type: 'custom',
          label: String(data.label).slice(0, 12),
          icon: data.icon || '🔗',
          iconUrl: data.iconUrl || '',
          href: data.href || '',
          target: data.target || '_self',
          enabled: data.enabled !== false,
          order: order,
          desc: '自定义模块',
          primary: false,
          config: data.config || null
        };
        list.push(mod);
        m.modules = list;
        var all = listMeetingsFromStore().map(function (x) { return x.id === m.id ? m : x; });
        adapter.set(KEYS.meetings, all);
        return mod;
      });
    },
    updateModule: function (id, patch) {
      return this.getCurrentMeeting().then(function (m) {
        var list = (m && m.modules) || buildDefaultModules();
        var idx = list.findIndex(function (x) { return x.id === id; });
        if (idx < 0) return Promise.reject(new Error('模块不存在：' + id));
        var x = list[idx];
        if (x.type === 'system') {
          ['enabled', 'label', 'icon', 'iconUrl', 'href', 'primary'].forEach(function (k) {
            if (patch && patch[k] !== undefined) x[k] = patch[k];
          });
        } else {
          if (patch) Object.keys(patch).forEach(function (k) { x[k] = patch[k]; });
        }
        list[idx] = x;
        m.modules = list;
        var all = listMeetingsFromStore().map(function (mm) { return mm.id === m.id ? m : mm; });
        adapter.set(KEYS.meetings, all);
        return x;
      });
    },
    removeModule: function (id) {
      return this.getCurrentMeeting().then(function (m) {
        var list = (m && m.modules) || buildDefaultModules();
        var x = list.filter(function (y) { return y.id === id; })[0];
        if (!x) return Promise.reject(new Error('模块不存在：' + id));
        if (x.type === 'system') return Promise.reject(new Error('系统模块不可删除（可关闭）'));
        list = list.filter(function (y) { return y.id !== id; });
        m.modules = list;
        var all = listMeetingsFromStore().map(function (mm) { return mm.id === m.id ? m : mm; });
        adapter.set(KEYS.meetings, all);
        return list;
      });
    },
    reorderModules: function (ids) {
      if (!Array.isArray(ids)) return Promise.reject(new Error('参数必须是 id 数组'));
      return this.getCurrentMeeting().then(function (m) {
        var list = (m && m.modules) || buildDefaultModules();
        var map = {}; list.forEach(function (x) { map[x.id] = x; });
        var newList = [];
        ids.forEach(function (id, i) {
          if (map[id]) { map[id].order = i; newList.push(map[id]); delete map[id]; }
        });
        Object.keys(map).forEach(function (k) { newList.push(map[k]); });
        m.modules = newList;
        var all = listMeetingsFromStore().map(function (mm) { return mm.id === m.id ? m : mm; });
        adapter.set(KEYS.meetings, all);
        return newList;
      });
    },
    resetModules: function () {
      return this.getCurrentMeeting().then(function (m) {
        m.modules = buildDefaultModules();
        var all = listMeetingsFromStore().map(function (x) { return x.id === m.id ? m : x; });
        adapter.set(KEYS.meetings, all);
        return m.modules;
      });
    },

    /* ---------- Emoji 图标库（v2.3） ---------- */
    listEmojiLibrary: function () {
      return Promise.resolve(EMOJI_LIBRARY.map(function (g) {
        return { group: g.group, name: g.name, items: g.items.slice() };
      }));
    },
    searchEmoji: function (kw) {
      if (!kw) return this.listEmojiLibrary();
      kw = String(kw).toLowerCase();
      return Promise.resolve(EMOJI_LIBRARY.map(function (g) {
        return {
          group: g.group, name: g.name,
          items: g.items.filter(function (e) {
            return g.group.toLowerCase().indexOf(kw) >= 0 ||
                   g.name.toLowerCase().indexOf(kw) >= 0 ||
                   e.indexOf(kw) >= 0;
          })
        };
      }).filter(function (g) { return g.items.length > 0; }));
    },

    /* ---------- 主题库（v2.3 升级 → v2.6 含 brand/css/js） ---------- */
    listThemes: function (opts) {
      var list = THEMES.map(function (t) {
        return { key: t.key, name: t.name, group: t.group, desc: t.desc, emoji: t.emoji, preview: t.preview,
                 brand: t.brand, brand2: t.brand2, css: t.css, js: t.js };
      });
      if (opts && opts.group) list = list.filter(function (t) { return t.group === opts.group; });
      return Promise.resolve(list);
    },
    /* 单个主题的完整配置（含 brand/css/js） */
    getThemeInfo: function (key) {
      var t = THEMES.filter(function (x) { return x.key === key; })[0] || null;
      if (!t) return Promise.resolve(null);
      return Promise.resolve({ key: t.key, name: t.name, group: t.group, desc: t.desc, emoji: t.emoji, preview: t.preview,
                              brand: t.brand, brand2: t.brand2, css: t.css, js: t.js });
    },
    listThemeGroups: function () {
      var groups = [];
      THEMES.forEach(function (t) { if (groups.indexOf(t.group) < 0) groups.push(t.group); });
      return Promise.resolve(groups);
    },
    getTheme: function () {
      // 优先从当前会议读
      return this.getCurrentMeeting().then(function (m) {
        if (m && m.theme) return m.theme;
        return 'default';
      });
    },
    setTheme: function (key) {
      if (!THEMES.some(function (t) { return t.key === key; })) {
        return Promise.reject(new Error('未知主题：' + key));
      }
      return this.getCurrentMeeting().then(function (m) {
        if (m) {
          m.theme = key;
          var list = listMeetingsFromStore();
          list = list.map(function (x) { return x.id === m.id ? m : x; });
          adapter.set(KEYS.meetings, list);
        } else {
          adapter.set(KEYS.theme, key);
        }
        return key;
      });
    },

    /* ---------- 多会议管理（v2.3） ---------- */
    listMeetings: function () {
      return Promise.resolve(listMeetingsFromStore().map(function (m) {
        return { id: m.id, dir: m.dir, name: m.name, slug: m.slug, summary: m.summary, lang: m.lang, status: m.status, createdAt: m.createdAt };
      }));
    },
    getCurrentMeeting: function () {
      var list = listMeetingsFromStore();
      var id = adapter.get(KEYS.currentMeeting) || (list[0] && list[0].id);
      return Promise.resolve(list.filter(function (m) { return m.id === id; })[0] || list[0] || null);
    },
    setCurrentMeeting: function (id) {
      if (!findMeeting(id)) return Promise.reject(new Error('会议不存在：' + id));
      adapter.set(KEYS.currentMeeting, id);
      return Promise.resolve(id);
    },
    getMeeting: function (id) {
      return Promise.resolve(findMeeting(id));
    },
    /* 新建会议：name/slug/summary/lang/status 可选
     * v2.4：会议必须自带完整的"私有数据"（空数组/空对象），不与默认会议共享
     * v2.9：新建时把 name 同步写入 meta.title / shortTitle / summary，
     *        避免新会议前端显示 SEED 种子（"2026 中国（深圳）..."） */
    addMeeting: function (data) {
      data = data || {};
      if (!data.name) return Promise.reject(new Error('会议名称必填'));
      var list = listMeetingsFromStore();
      var slug = (data.slug || ('m_' + Date.now().toString(36))).toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (list.some(function (m) { return m.slug === slug; })) slug = slug + '_' + uid('').slice(0, 4);
      var name = String(data.name).slice(0, 60);
      var summary = (data.summary || '').slice(0, 200);
      var m = {
        id: uid('mtg'),
        dir: slug,
        name: name,
        slug: slug,
        summary: summary,
        lang: data.lang || 'zh-CN',
        status: data.status || 'draft',
        createdAt: new Date().toISOString(),
        // 会议私有数据（v2.4：彻底隔离）
        meta: JSON.parse(JSON.stringify(SEED.meta)),
        speakers: [],
        agenda: [],
        materials: [],
        modules: buildDefaultModules(),
        theme: data.theme || 'light-academic'
      };
      // v2.9：把 name 同步写入 meta，让前端立即显示新会议名
      m.meta.title = name;
      m.meta.shortTitle = name;
      m.meta.summary = summary;
      if (data.meta && typeof data.meta === 'object') Object.assign(m.meta, data.meta);
      list.push(m);
      adapter.set(KEYS.meetings, list);
      // 初始化会议私有存储（regs/seats/stats）
      mtgReset(m.id);
      return Promise.resolve(m);
    },
    removeMeeting: function (id) {
      var list = listMeetingsFromStore();
      var m = findMeeting(id);
      if (!m) return Promise.reject(new Error('会议不存在：' + id));
      if (m.id === 'm_default') return Promise.reject(new Error('默认会议不可删除'));
      list = list.filter(function (x) { return x.id !== id; });
      adapter.set(KEYS.meetings, list);
      // 切到默认会议
      if (adapter.get(KEYS.currentMeeting) === id) adapter.set(KEYS.currentMeeting, 'm_default');
      return Promise.resolve(list);
    },
    /* 通用 patch：可改 name/summary/lang/status/dir/meta(浅合并) */
    updateMeeting: function (id, patch) {
      var list = listMeetingsFromStore();
      var m = findMeeting(id);
      if (!m) return Promise.reject(new Error('会议不存在：' + id));
      ['name', 'summary', 'lang', 'status', 'dir', 'theme'].forEach(function (k) {
        if (patch && patch[k] !== undefined) m[k] = patch[k];
      });
      if (patch && patch.meta) {
        m.meta = m.meta || {};
        Object.keys(patch.meta).forEach(function (k) { m.meta[k] = patch.meta[k]; });
      }
      list = list.map(function (x) { return x.id === m.id ? m : x; });
      adapter.set(KEYS.meetings, list);
      return Promise.resolve(m);
    },
    /* 生成会议微站 URL：index.html?m=<slug>（v2.4 多会议路由）
     * v2.7：按【指定会议】的主题切换入口文件（light-academic → index-la.html / 其他 → index.html）
     * 不传 idOrSlug 时返回当前会议 URL */
    getMeetingUrl: function (idOrSlug) {
      var self = this;
      var resolveMeeting = function () {
        if (idOrSlug) return Promise.resolve(findMeeting(idOrSlug));
        return self.getCurrentMeeting();
      };
      return resolveMeeting().then(function (meeting) {
        if (!meeting) return idOrSlug ? null : 'index.html';
        var entry = (meeting.theme === 'light-academic') ? 'index-la.html' : 'index.html';
        return entry + '?m=' + encodeURIComponent(meeting.slug || meeting.id);
      });
    },
    /* 用 slug 或 id 切到指定会议（找不到抛错） */
    switchMeeting: function (idOrSlug) {
      var m = findMeeting(idOrSlug);
      if (!m) return Promise.reject(new Error('会议不存在：' + idOrSlug));
      adapter.set(KEYS.currentMeeting, m.id);
      return Promise.resolve(m);
    }
  };

  global.ConfStore = API;
  // 兼容别名（旧代码 S.ensureSeed()）
  API.ensureSeed = API.init;
})(window);
