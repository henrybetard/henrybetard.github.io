(function () {
  'use strict';

  var C = window.SectorCore;
  var SAVE_KEY = 'sector_run_v3';
  var NS = 'http://www.w3.org/2000/svg';

  var state = loadState();
  C.useMap(state.map || 'core');
  var paused = true;
  var speed = 1;
  var timer = null;
  var panelId = state.current || 'mid';

  var el = {};
  ['opsBudget', 'opsIncome', 'opsRep', 'opsStable', 'opsTime', 'opsCorrupt', 'threatFill', 'threatNum', 'threatLabel',
    'opsHint', 'opsMeta', 'opsNetToggle', 'opsHelpToggle', 'opsHelp', 'opsHelpClose', 'opsNet', 'netUrl', 'netCreate', 'netJoin', 'netLeave', 'netCode', 'netStatus', 'opsMap', 'opsPause', 'opsSpeed', 'opsRestart', 'opsDiff', 'zoneName', 'zoneMeta', 'zoneBars',
    'zoneStab', 'zoneIns', 'zoneStabNum', 'zoneInsNum', 'actGarrison', 'actInfra', 'actSecurity', 'opsMapPick', 'actUnlock', 'actTravel',
    'garrisonExit', 'zoneHint', 'zoneRebel', 'initGrid', 'opsLog', 'opsToasts', 'opsEvent', 'eventTitle', 'eventText',
    'eventOptions', 'opsResult', 'resultTitle', 'resultText', 'resultStats', 'resultRestart'
  ].forEach(function (id) { el[id] = document.getElementById(id); });

  /* ---------------- 存档 ---------------- */
  function loadState() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.map && C.MAPS[s.map]) C.useMap(s.map);
        if (s && Array.isArray(s.zones) && s.zones.length === C.REGIONS.length && s.status) {
          s.zones.forEach(function (z) {
            if (!z.cd) z.cd = { calm: 0 };
            if (!z.cd.calm) z.cd.calm = 0;
            if (typeof z.stable !== 'boolean') z.stable = false;
            if (typeof z.lost !== 'boolean') z.lost = false;
            if (typeof z.unlocked !== 'boolean') z.unlocked = (z.id === 'mid');
            if (typeof z.garrison !== 'number') z.garrison = 0;
            if (!('garrisonBuilding' in z)) z.garrisonBuilding = null;
            if (typeof z.infra !== 'number') z.infra = typeof z.school === 'number' ? z.school : 0;
            if (typeof z.security !== 'number') z.security = 0;
            if (typeof z.buildInfra !== 'number') z.buildInfra = 0;
            if (typeof z.buildSecurity !== 'number') z.buildSecurity = 0;
            if (typeof z.road !== 'number') z.road = 0;
            if (typeof z.buildRoad !== 'number') z.buildRoad = 0;
            if (typeof z.freeGarrison !== 'boolean') z.freeGarrison = false;
            if (!('garrisonIncoming' in z)) z.garrisonIncoming = null;
          });
          if (!s.pending) s.pending = [];
          if (!s.log) s.log = [];
          if (!s.building) s.building = { roads: 0, logistics: 0, military: 0, garrison: 0, audit: 0 };
          if (!s.init) s.init = { roads: 0, logistics: 0, pr: 0, military: 0, garrison: 0, audit: 0 };
          ['roads', 'logistics', 'pr', 'training', 'military', 'garrison', 'audit'].forEach(function (k) {
            if (typeof s.init[k] !== 'number') s.init[k] = 0;
            if (typeof s.building[k] !== 'number') s.building[k] = 0;
          });
          if (typeof s.corruption !== 'number') s.corruption = 0;
          if (typeof s.threat !== 'number') s.threat = 0;
          if (typeof s.incomeAcc !== 'number') s.incomeAcc = 0;
          if (!Array.isArray(s.rebels)) s.rebels = [];
          if (typeof s.current !== 'string') s.current = 'mid';
          if (!('travel' in s)) s.travel = null;
          if (typeof s.nextRaid !== 'number') s.nextRaid = 40;
          if (typeof s.nextEvent !== 'number') s.nextEvent = 55;
          if (typeof s.nextSource !== 'number') s.nextSource = 25;
          return s;
        }
      }
    } catch (e) {}
    return C.createState('normal');
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------------- 地图 ---------------- */
  var zoneNodes = {};

  function buildMap() {
    el.opsMap.innerHTML = '';
    Object.keys(zoneNodes).forEach(function (k) { delete zoneNodes[k]; });
    el.opsMap.setAttribute('viewBox', '0 0 ' + C.VIEW.w + ' ' + C.VIEW.h);
    C.REGIONS.forEach(function (r) {
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'sz');
      g.setAttribute('data-id', r.id);
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', r.name);

      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M' + r.points.trim().split(/\s+/).join(' L') + ' Z');
      p.setAttribute('class', 'sz-shape');
      g.appendChild(p);

      var name = document.createElementNS(NS, 'text');
      name.setAttribute('x', r.cx);
      name.setAttribute('y', r.cy - 18);
      name.setAttribute('class', 'sz-name');
      name.textContent = r.name;
      g.appendChild(name);

      var bars = [];
      [-8, 0].forEach(function (dy, idx) {
        var bg = document.createElementNS(NS, 'rect');
        bg.setAttribute('x', r.cx - 26);
        bg.setAttribute('y', r.cy + dy);
        bg.setAttribute('width', 52);
        bg.setAttribute('height', 5);
        bg.setAttribute('rx', 2.5);
        bg.setAttribute('class', 'sz-bar-bg');
        g.appendChild(bg);
        bars.push(bg);
      });

      var barStab = document.createElementNS(NS, 'rect');
      barStab.setAttribute('y', r.cy - 8);
      barStab.setAttribute('height', 5);
      barStab.setAttribute('rx', 2.5);
      barStab.setAttribute('class', 'sz-bar-stab');
      g.appendChild(barStab);

      var barIns = document.createElementNS(NS, 'rect');
      barIns.setAttribute('y', r.cy);
      barIns.setAttribute('height', 5);
      barIns.setAttribute('rx', 2.5);
      barIns.setAttribute('class', 'sz-bar-ins');
      g.appendChild(barIns);

      var status = document.createElementNS(NS, 'text');
      status.setAttribute('x', r.cx);
      status.setAttribute('y', r.cy + 20);
      status.setAttribute('class', 'sz-status');
      g.appendChild(status);

      // 叛军标记
      var rebel = document.createElementNS(NS, 'g');
      rebel.setAttribute('class', 'sz-rebel');
      var flag = document.createElementNS(NS, 'path');
      flag.setAttribute('d', 'M0 0 L0 14 M0 1 L9 4 L0 7 Z');
      rebel.appendChild(flag);
      var mark = document.createElementNS(NS, 'circle');
      mark.setAttribute('cx', 12);
      mark.setAttribute('cy', -6);
      mark.setAttribute('r', 6);
      rebel.appendChild(mark);
      var mt = document.createElementNS(NS, 'text');
      mt.setAttribute('x', 12);
      mt.setAttribute('y', -3);
      mt.setAttribute('class', 'sz-rebel-text');
      mt.textContent = '!';
      rebel.appendChild(mt);
      rebel.setAttribute('transform', 'translate(' + (r.cx + 26) + ',' + (r.cy - 34) + ')');
      g.appendChild(rebel);

      g.addEventListener('click', function () { onZoneClick(r.id); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onZoneClick(r.id); }
      });

      el.opsMap.appendChild(g);
      zoneNodes[r.id] = { g: g, path: p, name: name, barStab: barStab, barIns: barIns, bars: bars, status: status, rebel: rebel, r: r };
    });
  }

  function zoneColor(z) {
    if (z.lost) return 'hsl(2 48% 20%)';
    if (z.stable) return 'hsl(142 38% 31%)';
    var t = C.clamp((z.stability - z.insurgency + 100) / 200, 0, 1);
    return 'hsl(' + Math.round(8 + 44 * t) + ' ' + Math.round(46 - 12 * t) + '% ' + Math.round(22 + 11 * t) + '%)';
  }

  function renderMap() {
    state.zones.forEach(function (z) {
      var n = zoneNodes[z.id];
      if (!n) return;
      var r = n.r;
      var locked = !z.unlocked;

      n.path.setAttribute('fill', z.lost ? zoneColor(z) : (locked ? 'hsl(210 12% 12%)' : zoneColor(z)));
      n.path.classList.toggle('is-selected', z.id === panelId || (state.travel && state.travel.to === z.id));
      n.path.classList.toggle('is-lost', !locked && z.lost);
      n.path.classList.toggle('is-locked', locked);
      n.g.classList.toggle('is-current', z.id === state.current && !locked);

      n.bars.forEach(function (b) { b.setAttribute('opacity', locked ? '0' : '1'); });
      var w = locked ? 0 : Math.max(0, Math.min(52, 52 * z.stability / 100));
      n.barStab.setAttribute('x', r.cx - 26);
      n.barStab.setAttribute('width', w);
      var wi = locked ? 0 : Math.max(0, Math.min(52, 52 * z.insurgency / 100));
      n.barIns.setAttribute('x', r.cx - 26);
      n.barIns.setAttribute('width', wi);

      n.rebel.classList.toggle('on', C.rebelsIn(state, z.id).length > 0);
      n.rebel.classList.toggle('is-locked', locked);

      var text = '';
      if (z.lost) text = '失守';
      else if (locked) text = '未解锁';
      else if (z.stable) text = z.garrison > 0 ? '稳定·L' + z.garrison : '稳定';
      else if (z.garrison > 0) text = '驻军 Lv' + z.garrison;
      else if (z.id === state.current) text = '当前区域';
      n.status.textContent = text;
      n.status.setAttribute('class', 'sz-status' + (locked ? '' : z.lost ? ' is-bad' : z.stable ? ' is-good' : z.garrison ? ' is-mid' : ''));
    });
  }

  /* ---------------- 面板 ---------------- */
  function renderStats() {
    el.opsBudget.textContent = Math.floor(state.budget);
    el.opsIncome.textContent = '+' + Math.round(C.income(state) * C.INCOME_EVERY) + '/' + C.INCOME_EVERY + '秒';
    el.opsRep.textContent = Math.round(state.reputation);
    el.opsStable.textContent = C.stableCount(state) + '/' + state.zones.length;
    el.opsTime.textContent = state.time + 's';
    el.opsCorrupt.textContent = Math.round(state.corruption);
    el.opsCorrupt.style.color = state.corruption >= 60 ? '#d1453b' : (state.corruption >= 35 ? '#d4a017' : '');

    el.opsPause.textContent = paused ? '继续' : '暂停';
    el.opsSpeed.textContent = '×' + speed;

    var lostCount = state.zones.filter(function (z) { return z.lost; }).length;
    if (el.opsMeta) {
      var metaText = '驻军 ' + C.garrisonedZones(state) + '/' + C.garrisonLimit(state) +
        ' · 叛军 ' + (state.rebels || []).length + ' 组 · 失守 ' + lostCount + ' 区';
      if (netActive() && netLib.mode() === 'versus' && oppScore) {
        metaText += ' · 对手 ' + oppScore.stable + ' 区 / 声望 ' + oppScore.rep;
      }
      el.opsMeta.textContent = metaText;
    }

    var pct = Math.round(state.threat * 100);
    el.threatFill.style.width = pct + '%';
    el.threatNum.textContent = pct + '%';
    el.threatLabel.textContent = '叛乱进度 · ' + C.DIFFICULTY[state.difficulty].name;

    if (el.opsMapPick) {
    Array.prototype.forEach.call(el.opsMapPick.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        var mapKey = b.getAttribute('data-map');
        if (netActive()) { setHint('联机中不能单方面切换地图，请先断开连接。', true); return; }
        if (mapKey === (state.map || 'core') && state.time === 0) return;
        if (state.time > 0 && !window.confirm('切换地图会重新开始，确定吗？')) return;
        restart(state.difficulty, mapKey);
        setHint('已切换到地图：' + (C.MAPS[mapKey] ? C.MAPS[mapKey].name : mapKey), false);
      });
    });
  }

  Array.prototype.forEach.call(el.opsDiff.querySelectorAll('button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-diff') === state.difficulty);
    });
    if (el.opsMapPick) {
      Array.prototype.forEach.call(el.opsMapPick.querySelectorAll('button'), function (b) {
        b.classList.toggle('on', b.getAttribute('data-map') === (state.map || 'core'));
      });
    }
  }

  function hide(node, yes) { if (node) node.classList.toggle('hidden', !!yes); }

  function renderGarrison(z) {
    var g = z.garrison;
    var gName = el.actGarrison.querySelector('.za-name');
    var gDesc = el.actGarrison.querySelector('.za-desc');
    var gCost = el.actGarrison.querySelector('.za-cost');
    var noSlot = g === 0 && C.garrisonedZones(state) >= C.garrisonLimit(state);

    var cap = C.garrisonMax(state);
    var incoming = z.garrisonIncoming;
    if (incoming) {
      gName.textContent = '驻军调遣中';
      gDesc.textContent = 'Lv' + incoming.level + ' 正在赶来 · 还需 ' + Math.ceil(incoming.left) + ' 秒';
      gCost.textContent = Math.ceil(incoming.left) + 's';
    } else if (g >= cap) {
      gName.textContent = '驻军 Lv' + g;
      gDesc.textContent = '每秒 ' + (10 * g) + ' 伤害叛军 · 稳定 ' + fmtStab(g);
      gCost.textContent = cap >= C.GARRISON.maxLevel ? '满级' : '需驻军训练';
    } else if (g === 0) {
      gName.textContent = '派驻驻军';
      gDesc.textContent = 'Lv1：免费 · 每秒 10 伤害叛军';
      gCost.textContent = noSlot ? '编制已满' : '免费';
    } else {
      gName.textContent = '升级驻军';
      gDesc.textContent = 'Lv' + (g + 1) + '：免费 · 每秒 ' + (10 * (g + 1)) + ' 伤害叛军';
      gCost.textContent = '免费';
    }
    el.actGarrison.disabled = !!incoming || g >= cap || noSlot || state.pending.length > 0;

    var rebels = C.rebelsIn(state, z.id);
    if (rebels.length) {
      var hp = 0, maxHp = 0;
      rebels.forEach(function (grp) { hp += grp.hp; maxHp += grp.maxHp; });
      var dmg = C.REBEL.dmgPerLevel * g;
      var topLv = Math.max.apply(null, rebels.map(function (grp) { return grp.level || 1; }));
      var blocked = g > 0 && g < topLv;
      el.zoneRebel.classList.remove('hidden');
      el.zoneRebel.innerHTML = '叛军 Lv' + topLv + ' ×' + rebels.length + ' 占据中：HP <b>' + Math.ceil(hp) + '/' + maxHp + '</b> · ' +
        (g === 0 ? '没有驻军，无法进攻'
         : blocked ? '驻军等级低于叛军，无法造成伤害'
         : '驻军每秒造成 ' + dmg + ' 伤害（约 ' + Math.ceil(hp / dmg) + ' 秒打垮）');
    } else {
      el.zoneRebel.classList.add('hidden');
    }
  }

  function renderZonePanel() {
    var z = C.zoneOf(state, panelId);
    var r = C.regionOf(panelId);
    if (!z || !r) return;
    el.zoneName.textContent = r.name + ' · 人口权重 ' + r.pop + (z.garrison ? ' · 驻军 Lv' + z.garrison : '') + (z.infra ? ' · 基建 Lv' + z.infra : '') + (z.security ? ' · 安保 Lv' + z.security : '');
    hide(el.zoneBars, !z.unlocked);
    el.zoneStab.style.width = Math.round(z.stability) + '%';
    el.zoneIns.style.width = Math.round(z.insurgency) + '%';
    el.zoneStabNum.textContent = Math.round(z.stability);
    el.zoneInsNum.textContent = Math.round(z.insurgency);

    var locked = !z.unlocked;
    hide(el.actUnlock, !locked);
    hide(el.actGarrison, locked);
    hide(el.garrisonExit, !(z.garrison > 0 || z.garrisonIncoming));
    if (locked) {
      var cost = C.unlockCost(state, z.id);
      var can = C.canUnlock(state, z.id);
      if (!can) {
        el.zoneMeta.textContent = '没有情报视野：该地块不与已解锁区域相邻，需要先解锁相邻地块。';
        el.actUnlock.disabled = true;
        el.actUnlock.querySelector('.za-cost').textContent = '不相邻';
      } else {
        el.zoneMeta.textContent = '没有情报视野：花费 ' + cost + ' 资金解锁才能看到局势。未解锁区域不会冻结，叛军仍在蔓延。';
        el.actUnlock.disabled = state.budget < cost;
        el.actUnlock.querySelector('.za-cost').textContent = state.budget < cost ? '资金不足' : String(cost);
      }
      hide(el.actTravel, true);
      hide(el.zoneRebel, true);
      return;
    }

    renderGarrison(z);

    var zoneBusy = z.buildInfra > 0 || z.buildSecurity > 0;
    [['infra', el.actInfra, '基建'], ['security', el.actSecurity, '加强安保']].forEach(function (item) {
      var key = item[0], btn = item[1], name = item[2];
      if (!btn) return;
      var level = z[key];
      var building = key === 'infra' ? z.buildInfra : z.buildSecurity;
      var cost = C.zoneProjectCost(state, z, key);
      var costEl = btn.querySelector('.za-cost');
      var nameEl = btn.querySelector('.za-name');
      var descEl = btn.querySelector('.za-desc');
      btn.classList.remove('is-locked');
      if (building > 0) {
        btn.classList.add('is-locked');
        nameEl.textContent = name + ' Lv' + level;
        descEl.textContent = '施工中 · ' + building + ' 秒后完成';
        costEl.textContent = '施工中';
        btn.disabled = true;
        return;
      }
      if (zoneBusy) {
        // 同一区域同时只允许一个项目施工：另一个按钮锁定
        btn.classList.add('is-locked');
        nameEl.textContent = name + ' Lv' + level;
        descEl.textContent = '本区正在施工，暂不可选';
        costEl.textContent = '锁定';
        btn.disabled = true;
        return;
      }
      nameEl.textContent = name + ' Lv' + level;
      descEl.textContent = key === 'infra' ? '本地稳定 +0.30/秒' : '本地叛乱增速 -10%/级';
      if (cost == null) {
        costEl.textContent = '满级';
        btn.disabled = true;
      } else {
        costEl.textContent = String(cost);
        btn.disabled = state.budget < cost || state.pending.length > 0;
      }
    });

    if (state.travel) {
      el.zoneMeta.textContent = '正在从 ' + C.regionOf(state.travel.from).name + ' 前往 ' + C.regionOf(state.travel.to).name + '：还需 ' + state.travel.left.toFixed(1) + ' 秒（驻军可远程调度）';
      hide(el.actTravel, true);
      return;
    }

    hide(el.actTravel, state.current === z.id);
    if (state.current !== z.id) {
      el.zoneMeta.textContent = '不在该区域：基建/安保需到场，驻军可远程免费调度。赶路 ' + C.travelTime(state, state.current, z.id).toFixed(1) + ' 秒。';
      el.actTravel.querySelector('.za-name').textContent = '确认前往';
      el.actTravel.querySelector('.za-cost').textContent = C.travelTime(state, state.current, z.id).toFixed(1) + 's';
      return;
    }

    el.zoneMeta.textContent = z.lost
      ? '区域已失守：驻军消灭叛军、把叛乱压到 60 以下可夺回。'
      : z.stable ? '已稳定：保持叛乱不高于 28 即可维持。'
      : z.garrison > 0 ? '驻军 Lv' + z.garrison + ' 正在压制（稳定 ' + fmtStab(z.garrison) + '）。'
      : '尚未稳定：投入基建，或派驻驻军压制。';
  }

  function fmtStab(level) {
    var v = Math.round(C.garrisonStab(state, level) * 100) / 100;
    return (v >= 0 ? '+' : '') + v.toFixed(2) + '/秒';
  }

  function renderInitiatives() {
    el.initGrid.innerHTML = C.INITIATIVES.map(function (def) {
      var lv = state.init[def.key];
      var cost = C.initiativeCost(state, def.key);
      var pips = '';
      for (var i = 0; i < def.max; i++) pips += '<i class="pip' + (i < lv ? ' on' : '') + '"></i>';
      var btn;
      if (cost == null) {
        btn = '<button class="init-buy" type="button" disabled>已满级</button>';
      } else if (state.building[def.key] > 0) {
        btn = '<button class="init-buy" type="button" disabled>建造中 · ' + state.building[def.key] + 's</button>';
      } else {
        btn = '<button class="init-buy" type="button" data-init="' + def.key + '"' +
          (state.budget < cost ? ' disabled' : '') + '>升级 · ' + cost + '</button>';
      }
      return '<div class="init-card">' +
        '<div class="init-head"><span class="init-name">' + def.name + '</span><span class="init-pips">' + pips + '</span></div>' +
        '<p class="init-desc">' + def.desc + '</p>' + btn + '</div>';
    }).join('');
  }

  function renderLog() {
    if (!state.log.length) {
      el.opsLog.innerHTML = '<li class="recent-empty">暂无事件</li>';
      return;
    }
    el.opsLog.innerHTML = state.log.slice(0, 10).map(function (item) {
      return '<li class="ops-log-item ' + (item.kind || 'info') + '"><span class="ops-log-time">' + item.t + 's</span>' +
        '<span class="ops-log-text">' + item.text + '</span></li>';
    }).join('');
  }

  /* ---------------- 事件弹窗 ---------------- */
  function renderEvent() {
    var ev = state.pending[0];
    if (!ev) { el.opsEvent.hidden = true; return; }
    el.opsEvent.hidden = false;
    el.eventTitle.textContent = ev.title;
    el.eventText.textContent = ev.text;
    el.eventOptions.innerHTML = ev.options.map(function (o, i) {
      return '<button type="button" data-opt="' + i + '">' + o.label + '</button>';
    }).join('');
  }

  function render() {
    renderStats();
    renderMap();
    renderZonePanel();
    renderInitiatives();
    renderLog();
    renderEvent();
  }

  /* ---------------- 交互 ---------------- */
  var lastLogText = '';
  function toast(text, kind) {
    if (!el.opsToasts || !text) return;
    var node = document.createElement('div');
    node.className = 'ops-toast ' + (kind || 'info');
    node.textContent = text;
    el.opsToasts.appendChild(node);
    setTimeout(function () {
      node.classList.add('out');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 300);
    }, 3000);
  }
  function toastNewLogs() {
    if (!state.log.length || state.log[0].text === lastLogText) return;
    var fresh = [];
    for (var i = 0; i < state.log.length; i++) {
      if (state.log[i].text === lastLogText) break;
      fresh.push(state.log[i]);
    }
    fresh.reverse().forEach(function (item, idx) {
      if (item.kind === 'info') return;
      setTimeout(function () { toast(item.text, item.kind); }, idx * 140);
    });
    lastLogText = state.log[0].text;
  }

  function setHint(text, bad) {
    el.opsHint.textContent = text;
    el.opsHint.classList.toggle('is-bad', !!bad);
  }

  function onZoneClick(id) {
    var z = C.zoneOf(state, id);
    if (!z) return;
    if (!z.unlocked) { panelId = id; render(); return; }
    if (state.pending.length) { setHint('请先处理当前事件。', true); return; }
    if (state.travel) { setHint('正在赶路，抵达后才能行动。', true); return; }
    panelId = id;
    if (state.current !== id) {
      setHint('已选中 ' + C.regionOf(id).name + '：确认「前往」后才会出发。', false);
    }
    render();
  }

  function afterAction(res) {
    if (!res.ok) { setHint(res.reason, true); render(); return; }
    setHint('已执行：' + res.text, false);
    save(); render();
  }

  function restart(diff, mapKey) {
    state = C.createState(diff || state.difficulty || 'normal', mapKey || state.map || 'core');
    buildMap();
    panelId = 'mid';
    paused = true;
    el.opsResult.hidden = true;
    el.opsEvent.hidden = true;
    lastLogText = '';
    save(); render();
    setHint('新一轮行动开始（难度：' + C.DIFFICULTY[state.difficulty].name + '）。', false);
    schedule();
  }

  /* ---------------- 联机 ---------------- */
  var netLib = window.SectorNet || null;
  var netModeSel = 'coop';
  var oppScore = null;
  var peerWon = false;
  var winSent = false;

  function netActive() { return !!(netLib && netLib.isConnected()); }
  function isCoopGuest() { return netActive() && netLib.mode() === 'coop' && netLib.isGuest(); }
  function setNetStatus(text) { if (el.netStatus) el.netStatus.textContent = text; }

  function serializeState() {
    var copy = {};
    for (var k in state) copy[k] = state[k];
    copy.log = (state.log || []).slice(0, 8);
    return copy;
  }

  function broadcastState() {
    if (!netActive() || !netLib.isHost()) return;
    netLib.sendState(serializeState());
  }

  function sendNetAction(name, args) {
    if (!isCoopGuest()) return false;
    netLib.sendAction(name, args);
    setHint('已发送给房主，等待同步…', false);
    return true;
  }

  function applyRemote(name, args) {
    if (!netActive() || !netLib.isHost()) return;
    var res = null;
    if (name === 'selectZone') res = C.selectZone(state, args.id);
    else if (name === 'unlock') res = C.unlockZone(state, args.id);
    else if (name === 'action') res = C.doAction(state, args.id, args.type);
    else if (name === 'exit') res = C.garrisonExit(state, args.id);
    else if (name === 'buy') res = C.buyInitiative(state, args.key);
    else if (name === 'event') res = C.resolveEvent(state, args.opt);
    if (res && res.ok) setHint('队友操作：' + (res.text || ''), false);
    save(); render(); broadcastState();
  }

  function scoreOf() {
    return {
      stable: C.stableCount(state),
      rep: Math.round(state.reputation),
      kills: state.stats.kills,
      time: state.time
    };
  }

  function initNet() {
    if (!netLib || !el.opsNet) return;
    if (el.netUrl) el.netUrl.value = netLib.defaultUrl();

    Array.prototype.forEach.call(el.opsNet.querySelectorAll('button[data-mode]'), function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(el.opsNet.querySelectorAll('button[data-mode]'), function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        netModeSel = b.getAttribute('data-mode');
      });
    });

    el.opsNetToggle.addEventListener('click', function () {
      el.opsNet.classList.toggle('hidden');
      if (!el.netUrl.value) el.netUrl.value = netLib.defaultUrl();
    });

    el.netCreate.addEventListener('click', function () {
      if (netActive()) { setNetStatus('已经在一个房间里了'); return; }
      setNetStatus('正在创建房间…');
      var createTimer = setTimeout(function () {
        if (!netActive()) setNetStatus('创建超时：无法连接服务器（确认已运行 node sector-server.js、地址正确）');
      }, 13000);
      var wsUrl = (el.netUrl.value || '').trim() || netLib.defaultUrl();
      netLib.create(netModeSel, function (err, code) {
        clearTimeout(createTimer);
        if (err) { setNetStatus('创建失败：' + err.message); return; }
        el.netLeave.classList.remove('hidden');
        setNetStatus('房间已创建：' + code + ' · 等队友输入房间码加入');
      }, wsUrl);
    });

    el.netJoin.addEventListener('click', function () {
      if (netActive()) { setNetStatus('已经在一个房间里了'); return; }
      var code = (el.netCode.value || '').trim().toUpperCase();
      if (!code) { setNetStatus('请输入房间码'); return; }
      setNetStatus('正在连接 ' + code + ' …');
      var joinTimer = setTimeout(function () {
        if (!netActive()) setNetStatus('连接超时：检查房间码、服务器地址，以及对方是否已创建房间');
      }, 13000);
      var joinUrl = (el.netUrl.value || '').trim() || netLib.defaultUrl();
      netLib.join(code, function (err) {
        clearTimeout(joinTimer);
        if (err) { setNetStatus('加入失败：' + err.message); return; }
        el.netLeave.classList.remove('hidden');
        setNetStatus('已连接，等待房主同步…');
      }, joinUrl);
    });

    el.netLeave.addEventListener('click', function () {
      netLib.close();
      el.netLeave.classList.add('hidden');
      setNetStatus('已断开');
      paused = true;
      renderStats();
    });

    netLib.on('open', function (info) {
      if (info.mode === 'versus') setNetStatus('对抗模式已连接：各自经营，先达标者胜');
      else setNetStatus('合作模式已连接：房主模拟，双方共同操作');
      if (netLib.isHost()) broadcastState();
    });

    netLib.on('peer', function (p) {
      if (p.joined) {
        setNetStatus(netLib.mode() === 'versus' ? '对手已加入，开始对抗' : '队友已加入');
        if (netLib.isHost()) broadcastState();
      } else {
        setNetStatus('对方已离开');
      }
    });

    netLib.on('close', function () {
      setNetStatus('连接已断开');
      el.netLeave.classList.add('hidden');
      if (isCoopGuest()) setHint('与房主的连接断开，已暂停。', true);
    });

    netLib.on('error', function (err) {
      setNetStatus('联机错误：' + ((err && err.message) || err));
    });

    netLib.on('state', function (snap) {
      if (!netLib.isGuest() || !snap) return;
      state = snap;
      if (state.map) C.useMap(state.map);
      if (!C.zoneOf(state, panelId)) panelId = 'mid';
      render();
      if (state.status !== 'playing') showResult();
    });

    netLib.on('action', function (msg) {
      if (netLib.isHost()) applyRemote(msg.name, msg.args);
    });

    netLib.on('score', function (sc) {
      oppScore = sc;
      render();
    });

    netLib.on('win', function () {
      if (netLib.mode() !== 'versus') return;
      if (state.status === 'playing') {
        peerWon = true;
        state.status = 'lost';
        save();
        showResult();
      }
    });
  }

  function showResult() {
    var won = state.status === 'won';
    var cmdZone = C.zoneOf(state, state.current);
    var midLost = !!(cmdZone && cmdZone.lost);
    el.resultTitle.textContent = won ? '行动成功' : '行动失败';
    el.resultText.textContent = won
      ? '全部区域恢复稳定，行动成功。'
      : peerWon ? '对手先完成了目标，你输了这场对抗。'
      : midLost ? '指挥官所在区域沦陷，行动失败。' : '声望耗尽，行动被迫中止。';
    el.resultStats.innerHTML =
      '<span>难度 <b>' + C.DIFFICULTY[state.difficulty].name + '</b></span>' +
      '<span>用时 <b>' + state.time + 's</b></span>' +
      '<span>稳定区 <b>' + C.stableCount(state) + '/' + state.zones.length + '</b></span>' +
      '<span>腐败 <b>' + Math.round(state.corruption) + '</b></span>' +
      '<span>歼敌 <b>' + state.stats.kills + '</b></span>' +
      '<span>事件 <b>' + state.stats.events + '</b></span>';
    el.opsResult.hidden = false;
  }

  function loop() {
    // 合作模式的访客不跑模拟，只渲染房主推来的状态
    if (isCoopGuest()) { render(); schedule(); return; }
    if (state.status === 'playing' && !paused && !state.pending.length) {
      C.tick(state);
      toastNewLogs();
      if (state.status !== 'playing') showResult();
      save();
      render();
      broadcastState();
      if (netActive() && netLib.mode() === 'versus') {
        if (state.time % 2 === 0) netLib.sendScore(scoreOf());
        if (state.status === 'won' && !winSent) { winSent = true; netLib.sendWin(scoreOf()); }
      }
    }
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(loop, 1000 / speed);
  }

  el.opsPause.addEventListener('click', function () {
    paused = !paused;
    renderStats();
    setHint(paused ? '已暂停。' : '继续行动。', false);
  });

  el.opsSpeed.addEventListener('click', function () {
    speed = speed === 1 ? 2 : 1;
    renderStats();
    schedule();
  });

  el.opsRestart.addEventListener('click', function () {
    if (netActive()) { setHint('联机中不能单方面重新开始，请先断开连接。', true); return; }
    if (window.confirm('重新开始会清空当前进度，确定吗？')) restart();
  });

  Array.prototype.forEach.call(el.opsDiff.querySelectorAll('button'), function (b) {
    b.addEventListener('click', function () {
      var diff = b.getAttribute('data-diff');
      if (netActive()) { setHint('联机中不能单方面切换难度，请先断开连接。', true); return; }
      if (diff === state.difficulty && state.time === 0) return;
      if (state.time > 0 && !window.confirm('切换难度会重新开始，确定吗？')) return;
      restart(diff);
    });
  });

  el.actGarrison.addEventListener('click', function () { if (sendNetAction('action', { id: panelId, type: 'garrison' })) return; afterAction(C.doAction(state, panelId, 'garrison')); });
  el.actInfra.addEventListener('click', function () { if (sendNetAction('action', { id: panelId, type: 'infra' })) return; afterAction(C.doAction(state, panelId, 'infra')); });
  el.actSecurity.addEventListener('click', function () { if (sendNetAction('action', { id: panelId, type: 'security' })) return; afterAction(C.doAction(state, panelId, 'security')); });
  el.garrisonExit.addEventListener('click', function () { if (sendNetAction('exit', { id: panelId })) return; afterAction(C.garrisonExit(state, panelId)); });
  el.actUnlock.addEventListener('click', function () { if (sendNetAction('unlock', { id: panelId })) return; afterAction(C.unlockZone(state, panelId)); });
  el.actTravel.addEventListener('click', function () {
    if (sendNetAction('selectZone', { id: panelId })) return;
    var res = C.selectZone(state, panelId);
    setHint(res.ok ? res.text : res.reason, !res.ok);
    save(); render();
  });

  el.initGrid.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-init]') : null;
    if (!btn) return;
    if (sendNetAction('buy', { key: btn.getAttribute('data-init') })) return;
    afterAction(C.buyInitiative(state, btn.getAttribute('data-init')));
  });

  el.eventOptions.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-opt]') : null;
    if (!btn) return;
    if (sendNetAction('event', { opt: Number(btn.getAttribute('data-opt')) })) return;
    var res = C.resolveEvent(state, Number(btn.getAttribute('data-opt')));
    if (res.ok) setHint('事件处理：' + res.text, false);
    save(); render();
    schedule();
  });

  el.resultRestart.addEventListener('click', function () { restart(); });

  el.opsHelpToggle.addEventListener('click', function () {
    el.opsHelp.hidden = !el.opsHelp.hidden;
  });
  el.opsHelpClose.addEventListener('click', function () { el.opsHelp.hidden = true; });
  el.opsHelp.addEventListener('click', function (e) {
    if (e.target === el.opsHelp) el.opsHelp.hidden = true;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !el.opsHelp.hidden) el.opsHelp.hidden = true;
  });

  initNet();
  buildMap();
  render();
  if (paused) setHint('已暂停：点「继续」开始行动。', false);
  if (state.status !== 'playing') showResult();
  schedule();
})();
