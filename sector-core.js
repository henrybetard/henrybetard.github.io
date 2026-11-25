// 《第七区 · 平叛行动》核心逻辑 v3
// 12 个六边形区域；叛军从出现的地块向邻区蔓延；事件会暂停游戏并要求做出选择。
(function (root) {
  'use strict';

  var VIEW = { w: 600, h: 400 };

  var MAPS = {
    core: {
      key: 'core', name: '第七区', cols: 4, rows: 3, r: 62, dx: 111, dy: 96, x0: 70, y0: 70,
      view: { w: 600, h: 400 },
      names: [
        ['北岭', '东岸', '高原', '边境'],
        ['西谷', '中州', '工业区', '荒原'],
        ['河谷', '南港', '远郊', '海岸']
      ],
      ids: [
        ['north', 'east', 'plateau', 'frontier'],
        ['west', 'mid', 'industry', 'wastes'],
        ['valley', 'south', 'outskirt', 'coast']
      ],
      pops: [
        [2, 2, 1, 1],
        [1, 3, 3, 1],
        [1, 2, 2, 1]
      ],
      mountains: ['高原', '北岭']
    },
    suburb: {
      key: 'suburb', name: '郊区', cols: 4, rows: 5, r: 54, dx: 104, dy: 90, x0: 80, y0: 58,
      view: { w: 560, h: 520 },
      names: [
        ['西郊', '北郊', '东郊', '河套'],
        ['南郊', '中郊', '旧城', '新港'],
        ['远郊', '谷口', '湖畔', '铁道'],
        ['沙洲', '荒地', '林场', '渡口'],
        ['山脚', '河口', '平原', '海堤']
      ],
      ids: [
        ['w1', 'n1', 'e1', 'r1'],
        ['s1', 'mid', 'o1', 'p1'],
        ['y1', 'g1', 'l1', 'c1'],
        ['d1', 'h1', 'f1', 'b1'],
        ['m1', 'k1', 'v1', 'q1']
      ],
      pops: [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1]
      ],
      mountains: []
    }
  };

  var REGIONS = [];
  var ADJ = {};
  var CURRENT_MAP = 'core';

  function hexPoints(cx, cy, r) {
    var pts = [];
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 180 * (60 * i + 30);
      pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
    }
    return pts.join(' ');
  }

  function buildRegions(mapKey) {
    var m = MAPS[mapKey] || MAPS.core;
    var list = [];
    for (var row = 0; row < m.rows; row++) {
      for (var col = 0; col < m.cols; col++) {
        var cx = m.x0 + col * m.dx + (row % 2 ? m.dx / 2 : 0);
        var cy = m.y0 + row * m.dy;
        var name = m.names[row][col];
        list.push({
          id: m.ids[row][col],
          name: name,
          pop: m.pops[row][col],
          col: col,
          row: row,
          cx: cx,
          cy: cy,
          points: hexPoints(cx, cy, m.r - 2),
          mountain: m.mountains.indexOf(name) >= 0,
          s0: m.ids[row][col] === 'mid' ? 52 : 0,
          i0: 6 + ((row * m.cols + col) * 3 + row * 2) % 12
        });
      }
    }
    return list;
  }

  function useMap(mapKey) {
    if (!MAPS[mapKey]) mapKey = 'core';
    CURRENT_MAP = mapKey;
    var m = MAPS[mapKey];
    VIEW.w = m.view.w;
    VIEW.h = m.view.h;
    REGIONS.length = 0;
    buildRegions(mapKey).forEach(function (r) { REGIONS.push(r); });
    Object.keys(ADJ).forEach(function (k) { delete ADJ[k]; });
    REGIONS.forEach(function (a) {
      ADJ[a.id] = REGIONS.filter(function (b) {
        if (a.id === b.id) return false;
        var dx = a.cx - b.cx, dy = a.cy - b.cy;
        return Math.sqrt(dx * dx + dy * dy) < m.dx * 1.15;
      }).map(function (b) { return b.id; });
    });
  }
  useMap('core');

  var INITIATIVES = [
    { key: 'roads', name: '公路', desc: '每级赶路 -0.8 秒', costs: [40, 70, 110, 150, 200], max: 5, build: 22 },
    { key: 'logistics', name: '后勤', desc: '每级 +1.2 资金/秒', costs: [45, 75, 115, 160, 210], max: 5, build: 22 },
    { key: 'pr', name: '宣传署', desc: '每级 +0.02 声望/秒', costs: [50, 90, 140, 200, 270], max: 5, build: 22 },
    { key: 'training', name: '驻军训练', desc: '每级 +1 驻军等级上限（最高 Lv4）', costs: [40, 80, 140], max: 3, build: 20 },
    { key: 'military', name: '军备', desc: '每级 +1 驻军区', costs: [30, 55, 85, 120, 160], max: 5, build: 15 },
    { key: 'garrison', name: '军政署', desc: '每级 +0.5 驻军稳定（转正）', costs: [45, 85, 130, 180, 240], max: 5, build: 20 },
    { key: 'audit', name: '审计署', desc: '每级 -0.10 腐败/秒', costs: [45, 80, 120, 165, 215], max: 5, build: 20 }
  ];

  var ACTIONS = {
    garrison: { name: '驻军', cost: 26, desc: '派驻清剿叛军，可升到 Lv3' }
  };

  // 叛军：占据地块、抬高叛乱；驻军能消灭它们；被消灭后隔一段时间重新刷新
  var REBEL = {
    maxGroups: 3,
    hp: 100,
    insPerSec: 0.95,
    decayPerSec: 0.22,
    dmgPerLevel: 20,
    respawn: 20,
    firstSpawn: 25,
    spawnGap: 26
  };

  var DIFFICULTY = {
    easy: {
      key: 'easy', name: '简单', insMul: 0.8, spawnGap: 62, respawn: 50,
      startBudget: 100, startRep: 120, incomeMul: 1, unlockMul: 1,
      eventGap: [55, 80], levelBoost: 0, repMul: 1
    },
    normal: {
      key: 'normal', name: '普通', insMul: 1.0, spawnGap: 56, respawn: 44,
      startBudget: 95, startRep: 112, incomeMul: 0.95, unlockMul: 1.2,
      eventGap: [52, 76], levelBoost: 0.04, repMul: 1.1
    },
    hard: {
      key: 'hard', name: '困难', insMul: 1.25, spawnGap: 46, respawn: 36,
      startBudget: 85, startRep: 100, incomeMul: 0.85, unlockMul: 1.4,
      eventGap: [44, 66], levelBoost: 0.08, repMul: 1.22
    }
  };

  var COOLDOWN = { calm: 5 };
  var GARRISON_BUILD = [0, 10, 14];
  var GARRISON = {
    maxLevel: 4,            // 驻军等级上限独立设定（与军备的编制数量无关）
    deployCost: 0,
    upgradeCost: [0, 0, 0, 0, 0],
    insCut: [0, 4.0, 6.0, 8.0, 10.0],
    stabPenalty: [0, 0.5, 0.5, 0.5, 0.5]   // 稳定惩罚与等级无关，固定 0.5/秒
  };
  var LOST_DRAIN = { threshold: 2, rate: 0.18 };

  var UNLOCK_BASE = 45;

  var START_BUDGET = 100;
  var INCOME_EVERY = 3;
  var START_REP = 120;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function round1(v) { return Math.round(v * 10) / 10; }
  function regionOf(id) {
    for (var i = 0; i < REGIONS.length; i++) if (REGIONS[i].id === id) return REGIONS[i];
    return null;
  }
  function zoneOf(s, id) {
    for (var i = 0; i < s.zones.length; i++) if (s.zones[i].id === id) return s.zones[i];
    return null;
  }
  function neighborsOf(id) { return ADJ[id] || []; }
  function diffOf(s) { return DIFFICULTY[s.difficulty] || DIFFICULTY.normal; }
  function garrisonLimit(s) { return s.init.military; }
  function garrisonMax(s) { return Math.min(GARRISON.maxLevel, 1 + (s.init.training || 0)); }
  function garrisonedZones(s) { return s.zones.filter(function (z) { return z.garrison > 0 && !z.freeGarrison; }).length; }
  function garrisonSlots(s) {
    return s.zones.filter(function (z) {
      return (z.garrison > 0 && !z.freeGarrison) || (z.garrisonIncoming && z.garrison === 0);
    }).length;
  }
  function stableCount(s) { return s.zones.filter(function (z) { return z.stable; }).length; }
  function unlockedCount(s) { return s.zones.filter(function (z) { return z.unlocked; }).length; }
  function rebelZones(s) { return s.zones.filter(function (z) { return s.rebels.some(function (g) { return g.zoneId === z.id; }); }); }
  function rebelsIn(s, id) { return s.rebels.filter(function (g) { return g.zoneId === id; }); }
  function income(s) {
    var up = 0;
    s.zones.forEach(function (z) { up += z.garrison * 0.6; });
    var raw = 4 + 0.6 * stableCount(s) + 1.2 * s.init.logistics - up;
    return Math.max(0, raw * diffOf(s).incomeMul);
  }
  function hexDist(a, b) {
    var dx = a.cx - b.cx, dy = a.cy - b.cy;
    return Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy) / 111));
  }
  function travelTime(s, fromId, toId) {
    var from = regionOf(fromId || s.current), to = regionOf(toId);
    if (!from || !to) return 4;
    var dx = from.cx - to.cx, dy = from.cy - to.cy;
    var unit = MAPS[CURRENT_MAP] ? MAPS[CURRENT_MAP].dx : 111;
    var steps = Math.sqrt(dx * dx + dy * dy) / unit;
    var t = 3 + 2.2 * steps - s.init.roads * 0.8;
    if (to.mountain) t += 1.2;    // 山地/高原
    if (to.pop === 1) t += 0.5;   // 人烟稀少
    return Math.max(2, t);
  }
  function unlockCost(s, id) {
    var r = regionOf(id);
    if (!r) return null;
    var mid = regionOf('mid');
    var dist = Math.sqrt(Math.pow(r.cx - mid.cx, 2) + Math.pow(r.cy - mid.cy, 2)) / 111;
    var cost = (25 + 22 * dist + 15 * (r.pop - 1) + (r.mountain ? 15 : 0)) * diffOf(s).unlockMul;
    return Math.round(cost / 5) * 5;
  }
  function initiativeCost(s, key) {
    var def = null;
    for (var i = 0; i < INITIATIVES.length; i++) if (INITIATIVES[i].key === key) def = INITIATIVES[i];
    if (!def) return null;
    var lv = s.init[key];
    if (lv >= def.max) return null;
    return Math.round(def.costs[lv] * (1 + s.corruption / 120));
  }
  function garrisonStab(s, level) {
    return -GARRISON.stabPenalty[level] + 0.5 * s.init.garrison;
  }

  function createState(difficulty, mapKey) {
    var diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    useMap(mapKey || 'core');
    return {
      map: mapKey || 'core',
      time: 0,
      budget: (DIFFICULTY[difficulty] || DIFFICULTY.normal).startBudget,
      reputation: (DIFFICULTY[difficulty] || DIFFICULTY.normal).startRep,
      incomeAcc: 0,
      status: 'playing',
      difficulty: diff.key,
      threat: 0,
      nextRaid: diff.firstRaid,
      nextEvent: 55,
      nextSource: 25,
      rebels: [],
      nextSpawn: 25,
      rebelRespawn: 0,
      current: 'mid',
      travel: null,
      corruption: 0,
      pending: [],
      zones: REGIONS.map(function (r) {
        return {
          id: r.id,
          stability: r.s0,
          insurgency: r.i0,
          garrison: 0,
          garrisonBuilding: null,
          infra: 0,
          security: 0,
          road: 0,
          buildInfra: 0,
          buildSecurity: 0,
          buildRoad: 0,
          freeGarrison: false,
          garrisonIncoming: null,
          stable: false,
          lost: false,
          unlocked: r.id === 'mid',
          cd: { calm: 0 }
        };
      }),
      init: { roads: 0, logistics: 0, pr: 0, training: 0, military: 0, garrison: 0, audit: 0 },
      building: { roads: 0, logistics: 0, pr: 0, training: 0, military: 0, garrison: 0, audit: 0 },
      stats: { calm: 0, garrison: 0, initiatives: 0, unlock: 0, events: 0, kills: 0 },
      log: []
    };
  }

  function pushLog(s, text, kind) {
    s.log.unshift({ t: s.time, text: text, kind: kind || 'info' });
    if (s.log.length > 60) s.log.pop();
  }

  /* ---------------- 事件 ---------------- */
  var EVENT_DEFS = [
    {
      kind: 'attack', title: '叛军突袭',
      text: '{zone} 遭到叛军突袭，必须立刻决定如何应对。',
      options: [
        { label: '调兵增援（-30 资金，叛乱 -15）', effects: { budget: -30, ins: -15 } },
        { label: '固守待援（稳定 -10，声望 -4）', effects: { stab: -10, rep: -4 } }
      ]
    },
    {
      kind: 'negotiation', title: '叛军提出谈判',
      text: '{zone} 的叛军代表愿意谈条件：给一笔钱，他们交出部分控制权。',
      options: [
        { label: '支付 40 资金（叛乱 -25）', effects: { budget: -40, ins: -25 } },
        { label: '拒绝谈判（声望 -6）', effects: { rep: -6 } }
      ]
    },
    {
      kind: 'aid', title: '人道危机',
      text: '{zone} 出现难民潮，需要立刻拨款安置。',
      options: [
        { label: '拨款 30（稳定 +12，声望 +3）', effects: { budget: -30, stab: 12, rep: 3 } },
        { label: '暂不处理（声望 -5，稳定 -8）', effects: { rep: -5, stab: -8 } }
      ]
    },
    {
      kind: 'militia', title: '民兵请求武装',
      text: '{zone} 的民兵请求发放武器，能立刻形成战斗力，但会滋生腐败、扰动地方秩序。',
      options: [
        { label: '武装民兵（驻军 +1，腐败 +8，稳定 -4）', effects: { corruption: 8, garrison: 1, stab: -4 } },
        { label: '拒绝（叛乱 +8）', effects: { ins: 8 } }
      ]
    },
    {
      kind: 'smuggling', title: '走私网络',
      text: '有人在 {zone} 经营走私线。查抄能拿到现钱，但会得罪地方势力；放任则他们按月孝敬。',
      options: [
        { label: '查抄（+25 资金，声望 +3）', effects: { budget: 25, rep: 3 } },
        { label: '抽成（+45 资金，腐败 +12）', effects: { budget: 45, corruption: 12 } }
      ]
    },
    {
      kind: 'press', title: '记者来访',
      text: '战地记者想采访 {zone} 的治理情况：可以安排一场漂亮的宣传，也可以让他们如实报道。',
      options: [
        { label: '安排正面报道（声望 +7，腐败 +5）', effects: { rep: 7, corruption: 5 } },
        { label: '如实公开（声望 +2，腐败 -4）', effects: { rep: 2, corruption: -4 } }
      ]
    },
    {
      kind: 'elders', title: '部落长老求见',
      text: '{zone} 的长老希望得到一笔安置款，换取当地合作。',
      options: [
        { label: '拨款 25（该区稳定 +10，叛乱 -8）', effects: { budget: -25, stab: 10, ins: -8 } },
        { label: '冷处理（稳定 -6，声望 -2）', effects: { stab: -6, rep: -2 } }
      ]
    },
    {
      kind: 'infight', title: '叛军内讧',
      text: '情报显示 {zone} 的叛军内部火并：现在压上去能重创他们，但按兵不动他们也可能自己散掉。',
      options: [
        { label: '立刻进攻（-25 资金，叛乱 -30）', effects: { budget: -25, ins: -30 } },
        { label: '坐观其变（叛乱 +4，声望 -1）', effects: { ins: 4, rep: -1 } }
      ]
    },
    {
      kind: 'intl_aid', title: '国际援助',
      text: '一个国际组织愿意向第七区提供援助，但附带监督条件。',
      options: [
        { label: '接受援助（+60 资金，腐败 +8）', effects: { budget: 60, corruption: 8 } },
        { label: '婉拒（声望 +3）', effects: { rep: 3 } }
      ]
    },
    {
      kind: 'plague', title: '疫情爆发',
      text: '{zone} 出现疫情，需要立刻处置。',
      options: [
        { label: '封锁疫区（-30 资金，稳定 -4，叛乱 -4）', effects: { budget: -30, stab: -4, ins: -4 } },
        { label: '放任不管（稳定 -8，声望 -5）', effects: { stab: -8, rep: -5 } }
      ]
    }
  ];

  function makeEvent(s) {
    var pool = s.zones.filter(function (z) { return z.lost; });
    if (!pool.length) return null;
    var target = pool[Math.floor(Math.random() * pool.length)];
    var def = EVENT_DEFS[Math.floor(Math.random() * EVENT_DEFS.length)];
    var r = regionOf(target.id);
    return {
      kind: def.kind,
      title: def.title,
      zoneId: target.id,
      text: def.text.replace('{zone}', r.name),
      options: def.options.map(function (o) {
        return { label: o.label, effects: Object.assign({}, o.effects) };
      })
    };
  }

  function queueEvent(s, kind) {
    var ev;
    if (kind) {
      var def = EVENT_DEFS.filter(function (d) { return d.kind === kind; })[0];
      ev = makeEvent(s);
      if (ev && def) {
        ev.kind = def.kind;
        ev.title = def.title;
        ev.text = def.text.replace('{zone}', regionOf(ev.zoneId).name);
        ev.options = def.options.map(function (o) { return { label: o.label, effects: Object.assign({}, o.effects) }; });
      }
    } else {
      ev = makeEvent(s);
    }
    if (!ev) return;
    ev.id = 'e' + (s.stats.events + 1);
    s.stats.events += 1;
    s.pending.push(ev);
    pushLog(s, '事件：' + ev.title + '（' + regionOf(ev.zoneId).name + '）', 'bad');
  }

  function resolveEvent(s, optionIndex) {
    var ev = s.pending[0];
    if (!ev) return { ok: false, reason: '没有待处理事件' };
    var opt = ev.options[optionIndex];
    if (!opt) return { ok: false, reason: '无效选项' };
    var fx = opt.effects || {};
    var z = zoneOf(s, ev.zoneId);
    if (fx.budget) s.budget = Math.max(0, s.budget + fx.budget);
    if (fx.rep) s.reputation = clamp(s.reputation + fx.rep, 0, 150);
    if (fx.corruption) s.corruption = clamp(s.corruption + fx.corruption, 0, 100);
    if (z) {
      if (fx.ins) z.insurgency = clamp(z.insurgency + fx.ins, 0, 100);
      if (fx.stab) z.stability = clamp(z.stability + fx.stab, 0, 100);
      if (fx.garrison) {
        z.garrison = Math.min(GARRISON.maxLevel, z.garrison + fx.garrison);
        z.freeGarrison = true;
      }
    }
    s.pending.shift();
    pushLog(s, ev.title + '：' + opt.label, 'info');
    return { ok: true, text: ev.title + ' → ' + opt.label };
  }

  /* ---------------- 主循环 ---------------- */
  function tick(s) {
    if (s.status !== 'playing') return [];
    if (s.pending.length) return [];      // 事件未处理时游戏暂停
    s.time += 1;
    s.incomeAcc += income(s);
    if (s.time % INCOME_EVERY === 0) {
      s.budget += s.incomeAcc;
      s.incomeAcc = 0;
    }

    var d = diffOf(s);
    s.corruption = clamp(s.corruption + 0.10 - s.init.audit * 0.10, 0, 100);

    if (s.travel) {
      s.travel.left -= 1;
      if (s.travel.left <= 0) {
        s.current = s.travel.to;
        pushLog(s, '已抵达 ' + regionOf(s.current).name, 'good');
        s.travel = null;
      }
    }

    Object.keys(s.building).forEach(function (key) {
      if (!s.building[key]) return;
      s.building[key] -= 1;
      if (s.building[key] <= 0) {
        s.building[key] = 0;
        s.init[key] += 1;
        s.stats.initiatives += 1;
        var def = INITIATIVES.filter(function (x) { return x.key === key; })[0];
        pushLog(s, '「' + def.name + '」建成，升到 ' + s.init[key] + ' 级', 'good');
      }
    });

    var events = [];

    // 叛军刷新
    if (s.time >= s.nextSpawn) {
      var spawnPool = s.zones.filter(function (z) {
        if (z.lost || z.stable) return false;
        var n = s.rebels.filter(function (g) { return g.zoneId === z.id; }).length;
        return true;    // 不限制单地块的叛军数量
      });
      var occupied = spawnPool.filter(function (z) {
        return z.insurgency >= 40 || s.rebels.some(function (g) { return g.zoneId === z.id; });
      });
      if (occupied.length) spawnPool = occupied;   // 被占领/高叛乱的地块更容易冒出新叛军
      if (spawnPool.length) {
        var sz = spawnPool[Math.floor(Math.random() * spawnPool.length)];
        var popBonus = 1 + (3 - regionOf(sz.id).pop) * 0.25;
        var prog = Math.min(1, s.time / 900);
        var lvl = 1 + (Math.random() < 0.10 + 0.30 * prog + d.levelBoost ? 1 : 0) + (Math.random() < 0.02 + 0.10 * prog + d.levelBoost * 0.4 ? 1 : 0);
        var rhp = Math.round(REBEL.hp * popBonus * (1 + 0.5 * (lvl - 1)));
        s.rebels.push({ zoneId: sz.id, hp: rhp, maxHp: rhp, moveCd: 30, lastZone: null, escapes: 0, level: lvl });
        pushLog(s, '叛军出现在 ' + regionOf(sz.id).name + '（占领中）', 'bad');
      }
      s.nextSpawn = s.time + d.spawnGap;
    }

    // 叛军行动：抬高所在区叛乱、压低稳定；被驻军消灭后进入刷新倒计时
    var dead = [];
    s.rebels.forEach(function (g) {
      var z = zoneOf(s, g.zoneId);
      if (!z) { dead.push(g); return; }
      if (g.moveCd > 0) g.moveCd--;
      z.insurgency = clamp(z.insurgency + REBEL.insPerSec * d.insMul * (1 + 0.5 * s.threat) * (1 - 0.10 * z.security), 0, 100);
      z.stability = clamp(z.stability - 0.25, 0, 100);

      if (z.security > 0) {
        g.hp = Math.max(0, g.hp - 1.5 * z.security);   // 极低速清理
        if (g.hp <= 0) {
          z.insurgency = clamp(z.insurgency - 15, 0, 100);
          s.stats.kills += 1;
          dead.push(g);
          s.rebelRespawn = s.time + d.respawn;
          s.nextSpawn = Math.max(s.nextSpawn, s.rebelRespawn);
          pushLog(s, regionOf(z.id).name + ' 的安保力量清剿了一股叛军', 'good');
          return;
        }
      }
      if (z.garrison > 0 && z.garrison >= (g.level || 1)) {
        var dmgMul = z.garrison === (g.level || 1) ? 0.5 : 1;
        g.hp -= REBEL.dmgPerLevel * z.garrison * dmgMul;
        if (g.hp <= 0) {
          // 打垮后先找退路：能跑就跑，跑不掉才被歼灭
          var escapes = neighborsOf(z.id).filter(function (nid) {
            var n = zoneOf(s, nid);
            return n && !n.stable && !s.rebels.some(function (x) { return x.zoneId === nid; });
          });
          // 刚布置/刚移动过的叛军组织度不足，被快攻打垮时来不及逃，只会被歼灭
          // 连逃两次后组织崩溃，再被围住就只能被歼灭
          // 突围最多两次：组织彻底崩溃后就跑不动了，只能被围歼
          if (escapes.length && (g.escapes || 0) < 2) {
            var dst = escapes[Math.floor(Math.random() * escapes.length)];
            g.zoneId = dst;
            g.hp = Math.round(g.maxHp * 0.35);
            g.moveCd = 24;
            g.lastZone = z.id;
            g.escapes = (g.escapes || 0) + 1;
            z.insurgency = clamp(z.insurgency - 12, 0, 100);
            pushLog(s, regionOf(z.id).name + ' 的叛军突围，逃往 ' + regionOf(dst).name, 'bad');
            return;
          }
          z.insurgency = clamp(z.insurgency - 30, 0, 100);
          s.stats.kills += 1;
          dead.push(g);
          s.rebelRespawn = s.time + d.respawn;
          s.nextSpawn = Math.max(s.nextSpawn, s.rebelRespawn);
          pushLog(s, regionOf(z.id).name + ' 的叛军被围歼，' + d.respawn + ' 秒后可能重新出现', 'good');
          return;
        }
      }

      // 主动进攻：叛军占住失守区后，会周期性进攻相邻地块
      if (z.lost && s.time % 12 === 0) {
        // 叛军会离开占领区，去打邻近的稳定/未稳定地块
        // 只允许进攻相邻格子：显式校验邻接表，防止越格攻击
        var atkTargets = neighborsOf(z.id).filter(function (nid) {
          var n = zoneOf(s, nid);
          return n && !n.lost && !s.rebels.some(function (x) { return x.zoneId === nid; });
        });
        if (atkTargets.length) {
          var stableOnes = atkTargets.filter(function (nid) { return zoneOf(s, nid).stable; });
          var targetPool = stableOnes.length && Math.random() < 0.6 ? stableOnes : atkTargets;
          var hitId = targetPool[Math.floor(Math.random() * targetPool.length)];
          var tn = zoneOf(s, hitId);
          tn.insurgency = clamp(tn.insurgency + 10, 0, 100);
          tn.stability = clamp(tn.stability - 6, 0, 100);
          s.reputation -= 0.4 * d.repMul;
          g.zoneId = hitId;          // 叛军真的开拔过去
          g.moveCd = 16;
          pushLog(s, regionOf(z.id).name + ' 的叛军出击，进攻 ' + regionOf(hitId).name, 'bad');
        }
      }

      // 逃逸：只有被彻底压住（区域稳定，或驻军 Lv2+ 且叛乱极低）才会换地块，
      // 而且每次逃逸后 16 秒内不再移动，并尽量不回上一个地块，避免满地图乱窜。
      var squeezed = z.stable || z.garrison >= 2;
      if (squeezed && g.moveCd <= 0) {
        var options = neighborsOf(z.id).filter(function (nid) {
          var n = zoneOf(s, nid);
          return n && !n.stable && !n.lost && !s.rebels.some(function (x) { return x.zoneId === nid; });
        });
        if (options.length > 1 && g.lastZone) {
          var filtered = options.filter(function (nid) { return nid !== g.lastZone; });
          if (filtered.length) options = filtered;
        }
        if (options.length) {
          var to = options[Math.floor(Math.random() * options.length)];
          g.lastZone = z.id;
          g.zoneId = to;
          g.moveCd = 16;
          pushLog(s, '叛军从 ' + regionOf(z.id).name + ' 逃窜到 ' + regionOf(to).name, 'bad');
        }
      }
    });
    if (dead.length) s.rebels = s.rebels.filter(function (g) { return dead.indexOf(g) === -1; });

    s.zones.forEach(function (z) {
      var r = regionOf(z.id);

      if (z.garrisonIncoming) {
        z.garrisonIncoming.left -= 1;
        if (z.garrisonIncoming.left <= 0.01) {
          z.garrison = z.garrisonIncoming.level;
          z.freeGarrison = false;
          z.garrisonIncoming = null;
          s.stats.garrison += 1;
          pushLog(s, r.name + ' 的驻军抵达，升到 Lv' + z.garrison, 'good');
        }
      }

      if (z.buildInfra > 0) {
        z.buildInfra -= 1;
        if (z.buildInfra === 0) { z.infra += 1; pushLog(s, r.name + ' 的基建建成（Lv' + z.infra + '）', 'good'); }
      }
      if (z.buildSecurity > 0) {
        z.buildSecurity -= 1;
        if (z.buildSecurity === 0) { z.security += 1; pushLog(s, r.name + ' 安保升级到 Lv' + z.security, 'good'); }
      }

      if (z.garrisonBuilding) {
        z.garrisonBuilding.left -= 1;
        if (z.garrisonBuilding.left <= 0) {
          z.garrison = z.garrisonBuilding.level;
          z.garrisonBuilding = null;
          pushLog(s, r.name + ' 驻军升级到 Lv' + z.garrison, 'good');
        }
      }

      var hasRebel = s.rebels.some(function (g) { return g.zoneId === z.id; });
      if (z.garrison > 0) {
        z.insurgency = Math.max(0, z.insurgency - 1.2 * z.garrison);
        z.stability += garrisonStab(s, z.garrison);
      }
      if (!hasRebel) {
        z.insurgency = Math.max(0, z.insurgency - REBEL.decayPerSec);
      }

      if (z.unlocked && z.garrison === 0) {
        z.stability += z.infra * 0.30 + 0.10;
      }

      if (z.insurgency > 65) {
        z.stability -= ((z.insurgency - 65) / 35) * (0.45 + r.pop * 0.12);
      }
      z.stability = clamp(z.stability, 0, 100);
      z.insurgency = clamp(z.insurgency, 0, 100);

      if (!z.lost && z.insurgency >= 100) {
        z.lost = true;
        s.reputation -= 4 * d.repMul;
        pushLog(s, r.name + ' 失守，叛乱完全控制该区', 'bad');
      }
      if (z.lost) {
        if (z.insurgency < 60) {
          z.lost = false;
          pushLog(s, r.name + ' 被重新控制', 'good');
        }
      }

      if (!z.stable && !z.lost && z.unlocked && z.stability >= 82 && z.insurgency <= 15 && !hasRebel) {
        z.stable = true;
        s.reputation = Math.min(150, s.reputation + 4);
        pushLog(s, r.name + ' 实现稳定，声望 +4', 'good');
      } else if (z.stable && (z.stability < 68 || z.insurgency > 28)) {
        z.stable = false;
        pushLog(s, r.name + ' 局势反复，失去稳定状态', 'bad');
      }
    });

    // 随机事件（暂停游戏，由玩家选择）
    if (s.time >= s.nextEvent && s.zones.some(function (z) { return z.lost; })) {
      queueEvent(s);
      var eg = d.eventGap;
      s.nextEvent = s.time + eg[0] + Math.random() * (eg[1] - eg[0]);
    }

    // 叛乱进度：由实际叛乱值与失守区数量决定（会随清剿回落），不再随时间只涨不跌
    var insSum = 0;
    s.zones.forEach(function (z) { insSum += z.insurgency; });
    var lostN = s.zones.filter(function (z) { return z.lost; }).length;
    s.threat = clamp((insSum / (s.zones.length * 100)) * 0.7 + (lostN / s.zones.length) * 0.6, 0, 1);

    // 被占领区域越多，声望缓慢流失；少量失守不会立刻崩盘
    var lostCount = s.zones.filter(function (z) { return z.lost; }).length;
    if (lostCount >= LOST_DRAIN.threshold) {
      s.reputation -= (lostCount - LOST_DRAIN.threshold + 1) * LOST_DRAIN.rate * d.repMul;
    }
    // 宣传署：缓慢提升声望
    s.reputation += s.init.pr * 0.02;

    // 拖太久会厌战：行动超过 10 分钟后声望缓慢流失，避免无限僵持
    if (s.time > 420) s.reputation -= (0.10 + (s.time - 420) * 0.0005) * d.repMul;

    s.reputation = clamp(s.reputation, 0, 150);

    var allUnlocked = s.zones.every(function (z) { return z.unlocked; });
    if (allUnlocked && s.zones.every(function (z) { return z.stable; }) && s.rebels.length === 0) {
      s.status = 'won';
      pushLog(s, '全部区域稳定，行动成功！', 'good');
    } else if (s.reputation <= 0 || (zoneOf(s, s.current) && zoneOf(s, s.current).lost)) {
      s.status = 'lost';
      pushLog(s, (zoneOf(s, s.current) && zoneOf(s, s.current).lost)
        ? '指挥官所在区域（' + regionOf(s.current).name + '）沦陷，行动失败'
        : '声望耗尽，行动失败', 'bad');
    }
    return events;
  }

  /* ---------------- 行动 ---------------- */
  function selectZone(s, id) {
    if (s.status !== 'playing') return { ok: false, reason: '行动已结束' };
    if (s.pending.length) return { ok: false, reason: '请先处理当前事件' };
    var z = zoneOf(s, id);
    if (!z) return { ok: false, reason: '区域不存在' };
    if (!z.unlocked) return { ok: false, reason: '该区域还没有情报视野' };
    if (s.travel) return { ok: false, reason: '正在赶路' };
    if (s.current === id) return { ok: true, text: '已在 ' + regionOf(id).name };
    var t = travelTime(s, s.current, id);
    s.travel = { from: s.current, to: id, left: t, total: t };
    pushLog(s, '从 ' + regionOf(s.current).name + ' 前往 ' + regionOf(id).name + '（' + t.toFixed(1) + ' 秒）', 'info');
    return { ok: true, text: '出发前往 ' + regionOf(id).name + '，约 ' + t.toFixed(1) + ' 秒' };
  }

  function canUnlock(s, id) {
    var z = zoneOf(s, id);
    if (!z || z.unlocked) return false;
    return neighborsOf(id).some(function (nid) {
      var n = zoneOf(s, nid);
      return n && n.unlocked;
    });
  }

  function unlockZone(s, id) {
    if (s.status !== 'playing') return { ok: false, reason: '行动已结束' };
    if (s.pending.length) return { ok: false, reason: '请先处理当前事件' };
    var z = zoneOf(s, id);
    if (!z) return { ok: false, reason: '区域不存在' };
    if (z.unlocked) return { ok: false, reason: '已经解锁' };
    if (!canUnlock(s, id)) return { ok: false, reason: '只能解锁与已解锁区域相邻的地块' };
    var cost = unlockCost(s, id);
    if (s.budget < cost) return { ok: false, reason: '资金不足（需要 ' + cost + '）' };
    s.budget -= cost;
    z.unlocked = true;
    s.stats.unlock += 1;
    pushLog(s, '解锁 ' + regionOf(id).name + ' 情报（-' + cost + '）', 'good');
    return { ok: true, text: '已解锁 ' + regionOf(id).name };
  }

  function canActIn(s, id) {
    if (s.pending.length) return { ok: false, reason: '请先处理当前事件' };
    if (s.travel) return { ok: false, reason: '正在赶路' };
    if (s.current !== id) return { ok: false, reason: '需要先前往该区域' };
    return { ok: true };
  }

  function doAction(s, zoneId, type) {
    if (s.status !== 'playing') return { ok: false, reason: '行动已结束' };
    var z = zoneOf(s, zoneId);
    var r = regionOf(zoneId);
    if (!z || !r) return { ok: false, reason: '区域不存在' };
    if (!z.unlocked) return { ok: false, reason: '该区域还没有情报视野' };
    if (type === 'garrison') return garrisonAction(s, z, r);

    var here = canActIn(s, zoneId);
    if (!here.ok) return here;
    if (type === 'infra' || type === 'security') return buildZoneProject(s, z, r, type);
    return { ok: false, reason: '未知行动' };
  }

  var ZONE_PROJECTS = {
    infra: { name: '基建', costs: [20, 35, 50], time: 14 },
    security: { name: '加强安保', costs: [22, 38, 55], time: 12 }
  };

  function zoneProjectCost(s, z, type) {
    var def = ZONE_PROJECTS[type];
    var lv = z[type];
    if (lv >= 3) return null;
    return Math.round(def.costs[lv] * (1 + s.corruption / 120));
  }

  function buildZoneProject(s, z, r, type) {
    var def = ZONE_PROJECTS[type];
    if (z[type] >= 3) return { ok: false, reason: '已满级' };
    var key = type === 'infra' ? 'buildInfra' : 'buildSecurity';
    if (z[key] > 0) return { ok: false, reason: '施工中（' + z[key] + ' 秒）' };
    var cost = zoneProjectCost(s, z, type);
    if (s.budget < cost) return { ok: false, reason: '资金不足（需要 ' + cost + '）' };
    s.budget -= cost;
    z[key] = def.time;
    pushLog(s, r.name + ' 的' + def.name + '开工，' + def.time + ' 秒', 'info');
    return { ok: true, text: r.name + ' · ' + def.name + ' 开工' };
  }

  function garrisonAction(s, z, r) {
    if (z.garrisonIncoming) {
      return { ok: false, reason: '已有驻军正在赶路（' + z.garrisonIncoming.left + ' 秒）' };
    }
    var cap = garrisonMax(s);
    if (z.garrison >= cap) {
      return { ok: false, reason: cap >= GARRISON.maxLevel ? '驻军已满级' : '需要升级「驻军训练」才能提高等级上限' };
    }
    if (z.garrison === 0 && garrisonSlots(s) >= garrisonLimit(s)) {
      return { ok: false, reason: '驻军区已满，升级「军备」' };
    }
    var level = z.garrison + 1;
    var delay = s.current === z.id ? 0 : Math.max(0, travelTime(s, s.current, z.id));
    if (delay <= 0.01) {
      z.garrison = level;
      z.freeGarrison = false;
      s.stats.garrison += 1;
      pushLog(s, r.name + ' 驻军升到 Lv' + level + '（指挥官就在当地）', 'good');
      return { ok: true, text: r.name + ' 驻军 Lv' + level };
    }
    z.garrisonIncoming = { level: level, left: delay, total: delay };
    pushLog(s, r.name + ' 的驻军从 ' + regionOf(s.current).name + ' 出发，' + delay.toFixed(1) + ' 秒后到达', 'info');
    return { ok: true, text: r.name + ' 驻军 Lv' + level + ' 正在赶来（' + delay.toFixed(1) + ' 秒）' };
  }

  function garrisonExit(s, zoneId) {
    var z = zoneOf(s, zoneId);
    if (!z) return { ok: false, reason: '区域不存在' };
    if (z.garrisonIncoming) {
      z.garrisonIncoming = null;
      pushLog(s, '取消了前往 ' + regionOf(zoneId).name + ' 的驻军调遣', 'info');
      return { ok: true, text: '已取消调遣' };
    }
    if (z.garrison === 0) return { ok: false, reason: '没有驻军' };
    z.garrison = 0;
    z.garrisonBuilding = null;
    pushLog(s, '从 ' + regionOf(zoneId).name + ' 撤出驻军', 'info');
    return { ok: true, text: '已撤军' };
  }

  function buyInitiative(s, key) {
    if (s.pending.length) return { ok: false, reason: '请先处理当前事件' };
    var def = null;
    for (var i = 0; i < INITIATIVES.length; i++) if (INITIATIVES[i].key === key) def = INITIATIVES[i];
    if (!def) return { ok: false, reason: '未知项目' };
    var lv = s.init[key];
    if (lv >= def.max) return { ok: false, reason: '已满级' };
    if (s.building[key] > 0) return { ok: false, reason: '建设中（' + s.building[key] + ' 秒）' };
    var cost = initiativeCost(s, key);
    if (s.budget < cost) return { ok: false, reason: '资金不足（需要 ' + cost + '）' };
    s.budget -= cost;
    s.corruption = clamp(s.corruption + 4, 0, 100);
    s.building[key] = def.build;
    pushLog(s, '「' + def.name + '」开工，' + def.build + ' 秒后建成', 'info');
    return { ok: true, text: def.name + ' 开工，' + def.build + ' 秒后完成' };
  }

  root.SectorCore = {
    VIEW: VIEW,
    REGIONS: REGIONS,
    ADJ: ADJ,
    INITIATIVES: INITIATIVES,
    ACTIONS: ACTIONS,
    DIFFICULTY: DIFFICULTY,
    GARRISON: GARRISON,
    INCOME_EVERY: INCOME_EVERY,
    createState: createState,
    tick: tick,
    doAction: doAction,
    garrisonAction: garrisonAction,
    garrisonExit: garrisonExit,
    zoneProjectCost: zoneProjectCost,
    ZONE_PROJECTS: ZONE_PROJECTS,
    MAPS: MAPS,
    useMap: useMap,
    currentMap: function () { return CURRENT_MAP; },
    selectZone: selectZone,
    unlockZone: unlockZone,
    unlockCost: unlockCost,
    canUnlock: canUnlock,
    canActIn: canActIn,
    buyInitiative: buyInitiative,
    initiativeCost: initiativeCost,
    resolveEvent: resolveEvent,
    queueEvent: queueEvent,
    garrisonStab: garrisonStab,
    income: income,
    travelTime: travelTime,
    garrisonLimit: garrisonLimit,
    garrisonMax: garrisonMax,
    garrisonedZones: garrisonedZones,
    garrisonSlots: garrisonSlots,
    stableCount: stableCount,
    unlockedCount: unlockedCount,
    rebelZones: rebelZones,
    rebelsIn: rebelsIn,
    REBEL: REBEL,
    neighborsOf: neighborsOf,
    regionOf: regionOf,
    zoneOf: zoneOf,
    clamp: clamp,
    round1: round1
  };
})(typeof window !== 'undefined' ? window : globalThis);
