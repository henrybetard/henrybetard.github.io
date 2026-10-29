(function () {
  const KEY = 'checkin_records';
  const EXCHANGE_KEY = 'checkin_exchange';

  const FORTUNES = [
    { name: '大吉', prob: 0.001, cls: 'fortune-big',   desc: '鸿运当头，今天做什么都顺' },
    { name: '中吉', prob: 0.01,  cls: 'fortune-mid',   desc: '好运将至，稳中求进' },
    { name: '小吉', prob: 0.05,  cls: 'fortune-small', desc: '小有收获，心情不错' },
    { name: '中平', prob: 0.10,  cls: 'fortune-flat',  desc: '平平稳稳，按部就班' }
  ];

  const FORTUNE_CLASS = {
    '大吉': 'fortune-big',
    '中吉': 'fortune-mid',
    '小吉': 'fortune-small',
    '中平': 'fortune-flat'
  };

  const todayCountEl = document.getElementById('todayCount');
  const streakEl = document.getElementById('streak');
  const totalCountEl = document.getElementById('totalCount');
  const recentListEl = document.getElementById('recentList');
  const calendarEl = document.getElementById('calendar');
  const checkinBtn = document.getElementById('checkinBtn');
  const hintEl = document.getElementById('checkinHint');
  const modal = document.getElementById('fortuneModal');
  const fortuneNameEl = document.getElementById('fortuneName');
  const fortuneDescEl = document.getElementById('fortuneDesc');
  const fortuneCloseBtn = document.getElementById('fortuneClose');
  const fBigEl = document.getElementById('fBig');
  const fMidEl = document.getElementById('fMid');
  const fSmallEl = document.getElementById('fSmall');
  const fFlatEl = document.getElementById('fFlat');

  const autoBtn = document.getElementById('autoBtn');
  const autoFreqEl = document.getElementById('autoFreq');
  const autoHintEl = document.getElementById('autoHint');
  const autoStopOnBigEl = document.getElementById('autoStopOnBig');
  // ==== 兑换 ====
  const exchangeButtons = document.querySelectorAll('.exchange-btn');
  const exchangeHintEl = document.getElementById('exchangeHint');
  const exchangeModal = document.getElementById('exchangeModal');
  const exchangeMsgEl = document.getElementById('exchangeMsg');
  const exchangeCloseBtn = document.getElementById('exchangeClose');

  if (!checkinBtn) return;

  // ---------- 存储 ----------
  function loadRecords() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return {};
      const out = {};
      Object.keys(data).forEach(function (k) {
        out[k] = (data[k] || []).map(function (item) {
          if (typeof item === 'string') return { time: item, fortune: '' };
          return { time: item.time || '', fortune: item.fortune || '' };
        });
      });
      return out;
    } catch (e) {
      return {};
    }
  }

  function saveRecords(records) {
    try { localStorage.setItem(KEY, JSON.stringify(records)); } catch (e) {}
  }

  // ==== 兑换存储 ====
  function loadExchanges() {
    const def = { '大吉': 0, '中吉': 0, '小吉': 0, '中平': 0 };
    try {
      const raw = localStorage.getItem(EXCHANGE_KEY);
      if (!raw) return def;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return def;
      return {
        '大吉': Number(data['大吉']) || 0,
        '中吉': Number(data['中吉']) || 0,
        '小吉': Number(data['小吉']) || 0,
        '中平': Number(data['中平']) || 0
      };
    } catch (e) {
      return def;
    }
  }

  function saveExchanges() {
    try { localStorage.setItem(EXCHANGE_KEY, JSON.stringify(exchanges)); } catch (e) {}
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }

  let records = loadRecords();
  let exchanges = loadExchanges();

  // ---------- 运势 ----------
  function drawFortune() {
    const r = Math.random();
    let acc = 0;
    for (let i = 0; i < FORTUNES.length; i++) {
      acc += FORTUNES[i].prob;
      if (r < acc) return FORTUNES[i];
    }
    return null;
  }

  function showFortune(f) {
    if (!modal || !fortuneNameEl || !fortuneDescEl) return;
    fortuneNameEl.textContent = f.name;
    fortuneNameEl.className = 'fortune-name ' + f.cls;
    fortuneDescEl.textContent = f.desc;
    modal.classList.add('show');
    const box = modal.querySelector('.fortune-box');
    if (box) {
      box.classList.remove('pop');
      void box.offsetWidth;
      box.classList.add('pop');
    }
  }

  function hideFortune() {
    if (modal) modal.classList.remove('show');
  }

  if (fortuneCloseBtn) fortuneCloseBtn.addEventListener('click', hideFortune);
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) hideFortune();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      hideFortune();
      hideExchangeModal();
    }
  });

  // ==== 兑换弹窗 ====
    function showExchangeModal(data) {
    if (!exchangeModal || !exchangeMsgEl) return;

    const toCls = FORTUNE_CLASS[data.to] || '';
    const fromCls = FORTUNE_CLASS[data.from] || '';

    // 标题按"获得"的运势变色
    const titleEl = exchangeModal.querySelector('.exchange-title');
    if (titleEl) {
      titleEl.className = 'exchange-title ' + toCls;
    }

    // 消息里两个运势名各自带颜色
    exchangeMsgEl.innerHTML =
      '获得 <span class="fortune-tag ' + toCls + '">' + data.to + '</span> × ' + data.gain +
      '，消耗 <span class="fortune-tag ' + fromCls + '">' + data.from + '</span> × ' + data.cost;

    exchangeModal.classList.add('show');
    const box = exchangeModal.querySelector('.fortune-box');
    if (box) {
      box.classList.remove('pop');
      void box.offsetWidth;
      box.classList.add('pop');
    }
  }

  function hideExchangeModal() {
    if (exchangeModal) exchangeModal.classList.remove('show');
  }

  if (exchangeCloseBtn) exchangeCloseBtn.addEventListener('click', hideExchangeModal);
  if (exchangeModal) {
    exchangeModal.addEventListener('click', function (e) {
      if (e.target === exchangeModal) hideExchangeModal();
    });
  }

  // ---------- 统计 ----------
  function computeStats() {
    const today = fmtDate(new Date());
    const todayArr = records[today] || [];
    let total = 0;
    Object.keys(records).forEach(function (k) { total += (records[k] || []).length; });

    let streak = 0;
    const cur = new Date();
    while (true) {
      const key = fmtDate(cur);
      if (records[key] && records[key].length > 0) {
        streak++;
        cur.setDate(cur.getDate() - 1);
      } else break;
    }
    return { todayCount: todayArr.length, total: total, streak: streak };
  }

  // 打卡抽到的原始数量
  function computeFortuneStats() {
    const s = { '大吉': 0, '中吉': 0, '小吉': 0, '中平': 0 };
    Object.keys(records).forEach(function (k) {
      (records[k] || []).forEach(function (item) {
        if (item.fortune && s[item.fortune] !== undefined) s[item.fortune]++;
      });
    });
    return s;
  }

  // ==== 可用数量 = 抽到的 + 兑换净变化 ====
  function availableFortunes() {
    const raw = computeFortuneStats();
    return {
      '大吉': raw['大吉'] + exchanges['大吉'],
      '中吉': raw['中吉'] + exchanges['中吉'],
      '小吉': raw['小吉'] + exchanges['小吉'],
      '中平': raw['中平'] + exchanges['中平']
    };
  }

  // ---------- 渲染 ----------
  function render() {
    const s = computeStats();
    todayCountEl.textContent = s.todayCount;
    streakEl.textContent = s.streak;
    totalCountEl.textContent = s.total;

    if (s.todayCount === 0) hintEl.textContent = '今天还没打卡，点一下试试';
    else hintEl.textContent = '今天已打卡 ' + s.todayCount + ' 次，继续保持';

    const fs = availableFortunes();
    if (fBigEl) fBigEl.textContent = fs['大吉'];
    if (fMidEl) fMidEl.textContent = fs['中吉'];
    if (fSmallEl) fSmallEl.textContent = fs['小吉'];
    if (fFlatEl) fFlatEl.textContent = fs['中平'];

    renderRecent();
    renderCalendar();
  }

  function renderRecent() {
    const all = [];
    Object.keys(records).forEach(function (date) {
      (records[date] || []).forEach(function (item) {
        all.push({ date: date, time: item.time, fortune: item.fortune || '' });
      });
    });
    all.sort(function (a, b) { return (b.date + b.time).localeCompare(a.date + a.time); });

    const recent = all.slice(0, 20);
    if (!recent.length) {
      recentListEl.innerHTML = '<li class="recent-empty">还没有打卡记录</li>';
      return;
    }
    recentListEl.innerHTML = recent.map(function (r) {
      const tag = r.fortune
        ? '<span class="fortune-tag ' + (FORTUNE_CLASS[r.fortune] || '') + '">' + r.fortune + '</span>'
        : '';
      return '<li class="recent-item">' +
        '<span class="recent-date">' + r.date + '</span>' +
        '<span class="recent-time">' + r.time + '</span>' +
        tag +
        '</li>';
    }).join('');
  }

  function levelOf(c) {
    if (c <= 0) return 0;
    if (c <= 1) return 1;
    if (c <= 3) return 2;
    if (c <= 6) return 3;
    return 4;
  }

  function renderCalendar() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cells = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = fmtDate(d);
      const c = records[key] ? records[key].length : 0;
      const lv = levelOf(c);
      cells.push(
        '<div class="cal-cell level-' + lv + '" title="' + key + '：' + c + ' 次">' +
          '<span class="cal-day">' + d.getDate() + '</span>' +
          (c > 0 ? '<span class="cal-count">' + c + '</span>' : '') +
        '</div>'
      );
    }
    calendarEl.innerHTML = cells.join('');
  }

  // ---------- 核心打卡 ----------
  let autoStats = null;

  function doCheckin(silent) {
    const now = new Date();
    const key = fmtDate(now);
    const time = fmtTime(now);
    const fortune = drawFortune();
    const entry = { time: time, fortune: fortune ? fortune.name : '' };

    if (!records[key]) records[key] = [];
    records[key].push(entry);
    saveRecords(records);

    render();

    if (!silent) {
      checkinBtn.classList.remove('pop');
      void checkinBtn.offsetWidth;
      checkinBtn.classList.add('pop');
      todayCountEl.classList.remove('bump');
      void todayCountEl.offsetWidth;
      todayCountEl.classList.add('bump');
      if (fortune) showFortune(fortune);
    } else if (autoStats) {
      autoStats.count++;
      if (fortune) autoStats.fortunes[fortune.name]++;

      // 勾选了"遇到大吉自动停下"且本次抽到大吉
      if (
        fortune &&
        fortune.name === '大吉' &&
        autoStopOnBigEl &&
        autoStopOnBigEl.checked
      ) {
        stopAuto();
        if (autoHintEl) {
          autoHintEl.textContent += '（遇到大吉，自动打卡已停止）';
        }
        showFortune(fortune);
        if (fortuneDescEl) {
          fortuneDescEl.textContent = fortune.desc + ' · 自动打卡已停止';
        }
      }
    }
  }

  checkinBtn.addEventListener('click', function () {
    doCheckin(false);
  });

  // ---------- 自动打卡 ----------
  let autoTimer = null;

  function startAuto() {
    if (autoTimer) return;
    const freq = Number(autoFreqEl.value) || 1;
    const interval = Math.round(1000 / freq);

    autoStats = { count: 0, fortunes: { '大吉': 0, '中吉': 0, '小吉': 0, '中平': 0 } };

    autoBtn.textContent = '停止自动打卡';
    autoBtn.classList.add('auto-on');
    autoFreqEl.disabled = true;
    autoHintEl.textContent = '自动打卡中…（' + freq + ' 次/秒，不弹窗）';

    autoTimer = setInterval(function () { doCheckin(true); }, interval);
  }

  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    autoBtn.textContent = '开始自动打卡';
    autoBtn.classList.remove('auto-on');
    autoFreqEl.disabled = false;

    if (autoStats && autoStats.count > 0) {
      const parts = [];
      Object.keys(autoStats.fortunes).forEach(function (k) {
        if (autoStats.fortunes[k] > 0) parts.push(k + ' ' + autoStats.fortunes[k]);
      });
      autoHintEl.textContent = '本次自动打卡 ' + autoStats.count + ' 次' +
        (parts.length ? '，运势：' + parts.join('、') : '，未抽中运势');
    } else {
      autoHintEl.textContent = '自动打卡期间不弹窗，停止后汇总本次结果';
    }
    autoStats = null;
  }

  if (autoBtn) {
    autoBtn.addEventListener('click', function () {
      if (autoTimer) stopAuto(); else startAuto();
    });
  }

  window.addEventListener('beforeunload', function () {
    if (autoTimer) clearInterval(autoTimer);
  });

  // ==== 兑换事件 ====
  exchangeButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const from = btn.dataset.from;
      const to = btn.dataset.to;
      const cost = Number(btn.dataset.cost);
      const gain = Number(btn.dataset.gain);

      const avail = availableFortunes();
      if (avail[from] < cost) {
        if (exchangeHintEl) {
          exchangeHintEl.textContent =
            '「' + from + '」不足：需要 ' + cost + ' 个，当前 ' + avail[from] + ' 个';
        }
        return;
      }

      exchanges[from] -= cost;
      exchanges[to] += gain;
      saveExchanges();
      render();

      if (exchangeHintEl) exchangeHintEl.textContent = '';
      showExchangeModal({ from: from, to: to, cost: cost, gain: gain });
    });
  });

  render();
})();