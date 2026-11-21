(function () {
  'use strict';

  // ============================================================
  // 1. 卡池数据
  // ============================================================
  var FACTIONS = {
    uk: { code: 'UK', name: '英国', color: '#6f9ad0' },
    de: { code: 'DE', name: '德国', color: '#d3ad4a' },
    su: { code: 'SU', name: '苏联', color: '#d9695f' },
    us: { code: 'US', name: '美国', color: '#78b892' },
    jp: { code: 'JP', name: '日本', color: '#d99ab5' },
    it: { code: 'IT', name: '意大利', color: '#9bbf6a' },
    fr: { code: 'FR', name: '法国', color: '#7f9fd8' },
    pl: { code: 'PL', name: '波兰', color: '#d38a8a' },
    fi: { code: 'FI', name: '芬兰', color: '#9fb8c8' }
  };

  var TYPES = {
    infantry: {
      name: '步兵',
      glyph: '<path d="M5.5 15a6.5 6.5 0 0 1 13 0Z"/>' +
        '<path d="M3.5 15h17"/>' +
        '<path d="M9 18.5h6"/>'
    },
    tank: {
      name: '坦克',
      glyph: '<path d="M4 16.5h16v4H4z"/>' +
        '<path d="M8 12h7v4.5H8z"/>' +
        '<path d="M15 13.2h6v2.1h-6z"/>' +
        '<circle cx="7.5" cy="20.5" r="1"/>' +
        '<circle cx="16.5" cy="20.5" r="1"/>'
    },
    artillery: {
      name: '炮兵',
      glyph: '<circle cx="7" cy="18" r="3"/>' +
        '<path d="M10 16.4 18.5 8"/>' +
        '<path d="M4 18h3"/>' +
        '<path d="M17.4 7.2 21 5"/>'
    },
    aircraft: {
      name: '飞机',
      glyph: '<path d="M12 3l2.2 6.4 6.8 2.6v2l-6.8-1v4.2L17 19.4v2l-5-1.4-5 1.4v-2l2.8-2.2V13L3 14v-2l6.8-2.6z"/>'
    },
    order: {
      name: '指令',
      glyph: '<path d="M13 2 5 14h6l-1 8 8-12h-6z"/>'
    },
    fighter: {
      name: '战斗机',
      glyph: '<path d="M12 3l2.2 6.4 6.8 2.6v2l-6.8-1v4.2L17 19.4v2l-5-1.4-5 1.4v-2l2.8-2.2V13L3 14v-2l6.8-2.6z"/>'
    },
    bomber: {
      name: '轰炸机',
      glyph: '<path d="M4 12h16v3H4z"/><path d="M9 12V7h6v5"/><path d="M11 6h2"/><path d="M6 18h12"/>'
    },
    counter: {
      name: '反制',
      glyph: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M9.5 12.5l2 2 3.5-4"/>'
    }
  };

  var RARITY = {
    common: { key: 'common', name: '标准', cls: 'rarity-common', rank: 0, weight: 700 },
    uncommon: { key: 'uncommon', name: '限定', cls: 'rarity-uncommon', rank: 1, weight: 200 },
    rare: { key: 'rare', name: '特殊', cls: 'rarity-rare', rank: 2, weight: 90 },
    elite: { key: 'elite', name: '精英', cls: 'rarity-elite', rank: 3, weight: 10 }
  };

  // 卡池来自 KARDS WIKI 的卡牌列表（kards-cards.js），只收录该 wiki 有收录的卡
  var CARDS = Array.isArray(window.KARDS_CARDS) ? window.KARDS_CARDS.slice() : [];

  var CARD_BY_ID = {};
  CARDS.forEach(function (c) { CARD_BY_ID[c.id] = c; });

  // ---- 消耗与保底 ----
  var COST_ONE = 10;          // 中平
  var COST_FIVE = 40;         // 中平
  var COST_PACK = 1;          // 中吉，卡包（5 张，限定起步）
  var PITY_LIMIT = 20;        // 连续 20 抽必出特殊以上

  // 卡包的概率表：不出标准，特殊/精英大幅提高（55 / 35 / 10）
  var PACK_WEIGHTS = { common: 0, uncommon: 550, rare: 350, elite: 100 };

  // ---- 存储键（与打卡页共用运势经济） ----
  var KEY_RECORDS = 'checkin_records';
  var KEY_EXCHANGE = 'checkin_exchange';
  var KEY_COLLECTION = 'kards_cards';
  var KEY_HISTORY = 'kards_history';
  var KEY_PITY = 'kards_pity';
  var KEY_GIFT = 'kards_gift';

  // ============================================================
  // 2. 元素
  // ============================================================
  var gFlat = document.getElementById('gFlat');
  var gSmall = document.getElementById('gSmall');
  var gMid = document.getElementById('gMid');
  var gBig = document.getElementById('gBig');
  var collectedEl = document.getElementById('collected');
  var totalCardsEl = document.getElementById('totalCards');
  var pityEl = document.getElementById('pityCount');
  var pityLimitEl = document.getElementById('pityLimit');
  var hintEl = document.getElementById('gachaHint');
  var resultSection = document.getElementById('resultSection');
  var resultGrid = document.getElementById('resultGrid');
  var resultClose = document.getElementById('resultClose');
  var collectionEl = document.getElementById('collection');
  var collectionHint = document.getElementById('collectionHint');
  var showLockedEl = document.getElementById('showLocked');
  var historyEl = document.getElementById('history');
  var drawOneBtn = document.getElementById('drawOne');
  var drawFiveBtn = document.getElementById('drawFive');
  var drawPackBtn = document.getElementById('drawPack');
  var drawEliteBtn = document.getElementById('drawElite');
  var flipAllBtn = document.getElementById('flipAll');

  if (!drawOneBtn) return;

  // ============================================================
  // 3. 存储
  // ============================================================
  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function readNumber(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      var n = Number(JSON.parse(raw));
      return isFinite(n) ? n : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function loadExchanges() {
    var def = { '大吉': 0, '中吉': 0, '小吉': 0, '中平': 0 };
    var data = readJSON(KEY_EXCHANGE, null);
    if (!data) return def;
    return {
      '大吉': Number(data['大吉']) || 0,
      '中吉': Number(data['中吉']) || 0,
      '小吉': Number(data['小吉']) || 0,
      '中平': Number(data['中平']) || 0
    };
  }

  var records = readJSON(KEY_RECORDS, {});
  var exchanges = loadExchanges();
  var collection = readJSON(KEY_COLLECTION, {});
  var storedHistory = readJSON(KEY_HISTORY, []);
  var history = Array.isArray(storedHistory) ? storedHistory : [];
  var pity = readNumber(KEY_PITY, 0);
  if (pity < 0) pity = 0;
  if (pity > PITY_LIMIT) pity = 0;

  // ============================================================
  // 4. 运势钱包（与打卡页一致：抽到的 + 兑换净变化）
  // ============================================================
  function rawFortunes() {
    var out = { '大吉': 0, '中吉': 0, '小吉': 0, '中平': 0 };
    Object.keys(records).forEach(function (date) {
      (records[date] || []).forEach(function (item) {
        var name = item && item.fortune ? item.fortune : (typeof item === 'string' ? '' : '');
        if (name && out[name] !== undefined) out[name] += 1;
      });
    });
    return out;
  }

  function available() {
    var raw = rawFortunes();
    return {
      '大吉': raw['大吉'] + exchanges['大吉'],
      '中吉': raw['中吉'] + exchanges['中吉'],
      '小吉': raw['小吉'] + exchanges['小吉'],
      '中平': raw['中平'] + exchanges['中平']
    };
  }

  function spend(fortune, amount) {
    var avail = available();
    if (avail[fortune] < amount) {
      setHint('「' + fortune + '」不足：需要 ' + amount + ' 个，当前 ' + avail[fortune] + ' 个，先去打卡攒一攒。');
      return false;
    }
    exchanges[fortune] -= amount;
    writeJSON(KEY_EXCHANGE, exchanges);
    return true;
  }

  // ---- 新手补给：第一次进页面送 20 中平，够抽两发 ----
  var giftGiven = false;
  try {
    if (!localStorage.getItem(KEY_GIFT)) {
      exchanges['中平'] += 20;
      writeJSON(KEY_EXCHANGE, exchanges);
      localStorage.setItem(KEY_GIFT, '1');
      giftGiven = true;
    }
  } catch (e) {}

  // ============================================================
  // 5. 抽卡逻辑
  // ============================================================
  function pickRarity(minRank, weights) {
    var pool = [];
    var total = 0;
    Object.keys(RARITY).forEach(function (key) {
      var r = RARITY[key];
      if (r.rank < minRank) return;
      var w = weights ? (weights[key] || 0) : r.weight;
      if (w <= 0) return;
      pool.push({ rarity: r, weight: w });
      total += w;
    });
    if (!pool.length) return RARITY.common;
    var roll = Math.random() * total;
    var acc = 0;
    for (var i = 0; i < pool.length; i++) {
      acc += pool[i].weight;
      if (roll < acc) return pool[i].rarity;
    }
    return pool[pool.length - 1].rarity;
  }

  function pickCard(rarityKey) {
    var pool = CARDS.filter(function (c) { return c.rarity === rarityKey; });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function drawOne(minRank, weights) {
    var floor = Math.max(minRank || 0, pity >= PITY_LIMIT ? 2 : 0);
    var rarity = pickRarity(floor, weights);
    if (rarity.rank >= 2) pity = 0;
    else pity += 1;
    return pickCard(rarity.key);
  }

  function drawMany(count, minRank, weights) {
    var out = [];
    var gotHigh = false;
    for (var i = 0; i < count; i++) {
      var card = drawOne(minRank || 0, weights);
      out.push(card);
      if (RARITY[card.rarity].rank >= 2) gotHigh = true;
    }
    // 五连 / 军官卡包保底：整组没有特殊以上时，把最后一张提上来
    if (count > 1 && !gotHigh) {
      out[out.length - 1] = drawOne(2);
    }
    return out;
  }

  // ============================================================
  // 6. 渲染
  // ============================================================
  function glyphSvg(type) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      TYPES[type].glyph + '</svg>';
  }

  function esc(text) {
    return String(text).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function cardHtml(card, opts) {
    opts = opts || {};
    var rarity = RARITY[card.rarity] || RARITY.common;
    var faction = FACTIONS[card.faction] || { code: '??', name: '未知', color: '#8a8f98' };
    var type = TYPES[card.type] || TYPES.infantry;
    var classes = 'kards-card ' + rarity.cls;
    if (!opts.owned) classes += ' locked';

    var count = opts.count || 0;
    var badge = '';
    if (opts.isNew) badge = '<span class="kc-new">NEW</span>';
    else if (count > 1) badge = '<span class="kc-count">×' + count + '</span>';

    var face = card.img
      ? '<img class="kc-img" src="' + esc(card.img) + '" alt="' + esc(card.name) + ' 卡面"' +
        ' loading="lazy" decoding="async" referrerpolicy="no-referrer">'
      : '<div class="kc-art-fallback">' + glyphSvg(card.type) + '</div>';

    return '<article class="' + classes + '" data-id="' + esc(card.id) + '">' +
      badge +
      '<div class="kc-face">' + face + '</div>' +
      '<div class="kc-cap">' +
        '<span class="kc-name">' + esc(card.name) + '</span>' +
        '<span class="kc-meta">' + faction.code + ' · ' + type.name + '</span>' +
      '</div>' +
      (opts.owned ? '' : '<span class="kc-lock">未获得</span>') +
      '</article>';
  }

  function setHint(text) {
    if (hintEl) hintEl.textContent = text;
  }

  function renderWallet() {
    var avail = available();
    if (gFlat) gFlat.textContent = avail['中平'];
    if (gSmall) gSmall.textContent = avail['小吉'];
    if (gMid) gMid.textContent = avail['中吉'];
    if (gBig) gBig.textContent = avail['大吉'];

    if (drawOneBtn) drawOneBtn.disabled = avail['中平'] < COST_ONE;
    if (drawFiveBtn) drawFiveBtn.disabled = avail['中平'] < COST_FIVE;
    if (drawPackBtn) drawPackBtn.disabled = avail['中吉'] < COST_PACK;
    if (drawEliteBtn) drawEliteBtn.disabled = avail['大吉'] < 1;
  }

  function renderProgress() {
    var owned = CARDS.filter(function (c) { return (collection[c.id] || 0) > 0; }).length;
    if (collectedEl) collectedEl.textContent = owned;
    if (totalCardsEl) totalCardsEl.textContent = CARDS.length;
    if (pityEl) pityEl.textContent = pity;
    if (pityLimitEl) pityLimitEl.textContent = PITY_LIMIT;
  }

  function renderCollection() {
    if (!collectionEl) return;
    var ownedCount = CARDS.filter(function (c) { return (collection[c.id] || 0) > 0; }).length;
    var showAll = !!(showLockedEl && showLockedEl.checked);
    var list = CARDS.filter(function (c) {
      return showAll || (collection[c.id] || 0) > 0;
    });

    if (!list.length) {
      collectionEl.innerHTML = '<p class="recent-empty">还没有获得任何卡，先开一包吧。</p>';
    } else {
      collectionEl.innerHTML = list.map(function (c) {
        var count = collection[c.id] || 0;
        return cardHtml(c, { owned: count > 0, count: count });
      }).join('');
    }

    if (collectionHint) {
      if (ownedCount === CARDS.length) collectionHint.textContent = '全部集齐了，恭喜！';
      else if (showAll) collectionHint.textContent = '已集齐 ' + ownedCount + ' / ' + CARDS.length + '（正在显示全部卡）。';
      else collectionHint.textContent = '已集齐 ' + ownedCount + ' / ' + CARDS.length + '，未获得的卡默认隐藏。';
    }
  }

  function renderHistory() {
    if (!historyEl) return;
    if (!history.length) {
      historyEl.innerHTML = '<li class="recent-empty">还没有抽过卡</li>';
      return;
    }
    historyEl.innerHTML = history.slice(0, 15).map(function (item) {
      var card = CARD_BY_ID[item.id];
      if (!card) return '';
      var rarity = RARITY[card.rarity];
      return '<li class="kards-log-item">' +
        '<span class="kards-log-time">' + item.t + '</span>' +
        '<span class="kards-log-name">' + card.name + '</span>' +
        '<span class="kards-rarity-tag ' + rarity.cls + '">' + rarity.name + '</span>' +
        '</li>';
    }).join('');
  }

  function cardBackHtml() {
    return '<div class="kc-side kc-back" aria-hidden="true">' +
      '<div class="kc-back-mark">' +
        '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">' +
          '<rect x="3" y="3" width="58" height="58" rx="6" stroke-opacity="0.45"/>' +
          '<path d="M32 13 L51 47 L13 47 Z" fill="currentColor" fill-opacity="0.08"/>' +
          '<circle cx="32" cy="37" r="7.5" stroke-width="1.2" stroke-opacity="0.75"/>' +
          '<path d="M32 26.5v3M32 44v3M21.5 37h3M39.5 37h3" stroke-width="1.2"/>' +
        '</svg>' +
        '<span class="kc-back-word">KARDS</span>' +
        '<span class="kc-back-hint">点击翻开</span>' +
      '</div>' +
    '</div>';
  }

  function flipItem(item) {
    if (!item || item.getAttribute('data-flipped') === 'true') return;
    item.setAttribute('data-flipped', 'true');
    item.classList.add('flipped');
  }

  function flipAll() {
    if (!resultGrid) return;
    var items = resultGrid.querySelectorAll('.gacha-result-item');
    Array.prototype.forEach.call(items, function (item, i) {
      setTimeout(function () { flipItem(item); }, i * 170);
    });
  }

  function renderResults(cards, newFlags) {
    if (!resultSection || !resultGrid) return;
    resultSection.hidden = false;
    resultGrid.innerHTML = cards.map(function (card, i) {
      var rarity = RARITY[card.rarity];
      return '<div class="gacha-result-item" role="button" tabindex="0" aria-label="翻开卡牌" data-flipped="false" data-rarity="' + card.rarity + '" style="animation-delay:' + (i * 90) + 'ms">' +
        '<div class="kc-flipper">' +
          '<div class="kc-side kc-front">' +
            cardHtml(card, { owned: true, count: collection[card.id] || 1, isNew: newFlags[card.id] }) +
          '</div>' +
          cardBackHtml() +
        '</div>' +
        '<div class="gacha-result-label ' + rarity.cls + '">' + rarity.name + '</div>' +
      '</div>';
    }).join('');

    var items = resultGrid.querySelectorAll('.gacha-result-item');
    Array.prototype.forEach.call(items, function (item) {
      item.addEventListener('click', function () { flipItem(item); });
      item.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          flipItem(item);
        }
      });
    });

    resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ============================================================
  // 7. 抽卡流程
  // ============================================================
  function nowText() {
    var d = new Date();
    function pad(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function commit(cards) {
    var newFlags = {};
    cards.forEach(function (card) {
      if (!collection[card.id]) newFlags[card.id] = true;
      collection[card.id] = (collection[card.id] || 0) + 1;
      history.unshift({ t: nowText(), id: card.id });
    });
    history = history.slice(0, 40);
    writeJSON(KEY_COLLECTION, collection);
    writeJSON(KEY_HISTORY, history);
    writeJSON(KEY_PITY, pity);
  }

  function summarize(cards) {
    var counts = {};
    cards.forEach(function (c) {
      var name = RARITY[c.rarity].name;
      counts[name] = (counts[name] || 0) + 1;
    });
    return ['精英', '特殊', '限定', '标准']
      .filter(function (k) { return counts[k]; })
      .map(function (k) { return k + ' ×' + counts[k]; })
      .join('、');
  }

  function runDraw(kind) {
    var cards = null;

    if (kind === 'one') {
      if (!spend('中平', COST_ONE)) { renderWallet(); return; }
      cards = drawMany(1, 0);
    } else if (kind === 'five') {
      if (!spend('中平', COST_FIVE)) { renderWallet(); return; }
      cards = drawMany(5, 0);
    } else if (kind === 'pack') {
      if (!spend('中吉', COST_PACK)) { renderWallet(); return; }
      cards = drawMany(5, 1, PACK_WEIGHTS);
    } else {
      if (!spend('大吉', 1)) { renderWallet(); return; }
      cards = drawMany(1, 3);
      pity = 0;
    }

    var newFlags = {};
    cards.forEach(function (c) { if (!collection[c.id]) newFlags[c.id] = true; });
    commit(cards);

    renderWallet();
    renderProgress();
    renderCollection();
    renderHistory();
    renderResults(cards, newFlags);

    var prefix = kind === 'pack' ? '卡包：' : '本次获得：';
    setHint(prefix + summarize(cards) + '（点击卡背翻开）' +
      (pity >= PITY_LIMIT ? ' · 下一抽必出特殊以上' : ''));
  }

  if (drawOneBtn) drawOneBtn.addEventListener('click', function () { runDraw('one'); });
  if (drawFiveBtn) drawFiveBtn.addEventListener('click', function () { runDraw('five'); });
  if (drawPackBtn) drawPackBtn.addEventListener('click', function () { runDraw('pack'); });
  if (drawEliteBtn) drawEliteBtn.addEventListener('click', function () { runDraw('elite'); });
  if (flipAllBtn) flipAllBtn.addEventListener('click', flipAll);
  if (showLockedEl) showLockedEl.addEventListener('change', function () { renderCollection(); });

  if (resultClose) {
    resultClose.addEventListener('click', function () {
      if (resultSection) resultSection.hidden = true;
    });
  }

  // ============================================================
  // 8. 启动
  // ============================================================
  if (giftGiven) setHint('已发放新手补给：中平 ×20，先抽两发试试手气。');
  renderWallet();
  renderProgress();
  renderCollection();
  renderHistory();
})();
