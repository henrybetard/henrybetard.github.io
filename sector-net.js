// 《第七区》联机层：自建 Node WebSocket 房间服务器（sector-server.js）
// 合作：房主跑模拟，通过服务器转发 state，访客把操作转发给房主。
// 对抗：双方各自跑本地局，经服务器互发比分与胜负。
(function (root) {
  'use strict';

  var handlers = {};
  var ws = null;
  var role = null;          // 'host' | 'guest'
  var mode = null;         // 'coop' | 'versus'
  var code = null;
  var connected = false;
  var manualClose = false;
  var want = null;          // { type:'create'|'join', mode, code }
  var retry = 0;
  var retryTimer = null;
  var pingTimer = null;
  var connectCb = null;

  function on(kind, fn) { handlers[kind] = fn; }
  function emit(kind, payload) { if (handlers[kind]) handlers[kind](payload); }

  function defaultUrl() {
    var loc = root.location;
    if (loc && loc.protocol === 'https:') return 'wss://' + loc.host;
    if (loc && loc.protocol === 'http:') return 'ws://' + loc.host;
    return 'ws://localhost:8787';
  }

  function sendRaw(obj) {
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify(obj)); return true; } catch (e) {}
    }
    return false;
  }

  function sendMsg(data) {
    return sendRaw({ t: 'msg', data: data });
  }

  function stopPing() { clearInterval(pingTimer); pingTimer = null; }
  function startPing() {
    stopPing();
    pingTimer = setInterval(function () {
      if (connected) sendRaw({ t: 'ping' });
    }, 20000);
  }

  function handle(raw) {
    var msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.t === 'room') {
      connected = true;
      role = msg.host ? 'host' : 'guest';
      mode = msg.mode || mode;
      code = msg.code;
      retry = 0;
      startPing();
      if (want) want = { type: 'rejoin', code: code, role: role, url: want.url };
      if (connectCb) {
        var cb = connectCb;
        connectCb = null;
        cb(null, code);
      }
      emit('open', { role: role, mode: mode, code: code });
      return;
    }
    if (msg.t === 'msg') {
      var d = msg.data;
      if (!d || !d.t) return;
      emit(d.t, d);
      return;
    }
    if (msg.t === 'peer') {
      emit('peer', { joined: !!msg.joined });
      return;
    }
    if (msg.t === 'error') {
      var err = new Error(msg.msg || '联机错误');
      if (connectCb) {
        var cb2 = connectCb;
        connectCb = null;
        cb2(err);
      }
      emit('error', err);
      return;
    }
    if (msg.t === 'left') { emit('left'); }
  }

  function cleanupSocket() {
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try { ws.close(); } catch (e) {}
    }
    ws = null;
  }

  function scheduleReconnect() {
    if (manualClose || !want) return;
    clearTimeout(retryTimer);
    var delay = Math.min(8000, 1000 * Math.pow(2, Math.min(retry, 3)));
    retry++;
    retryTimer = setTimeout(function () { openSocket(want.url); }, delay);
  }

  function openSocket(url) {
    cleanupSocket();
    try { ws = new root.WebSocket(url); } catch (e) {
      emit('error', e);
      return;
    }
    var settled = false;
    var timeout = setTimeout(function () {
      if (settled) return;
      settled = true;
      if (connectCb) {
        var cb = connectCb;
        connectCb = null;
        cb(new Error('连接超时：' + url));
      }
      try { ws.close(); } catch (e) {}
    }, 8000);

    ws.onopen = function () {
      clearTimeout(timeout);
      connected = false;
      if (want && want.type === 'join') sendRaw({ t: 'join', code: want.code });
      else if (want && want.type === 'rejoin') sendRaw({ t: 'rejoin', code: want.code, role: want.role });
      else if (want && want.type === 'create') sendRaw({ t: 'create', mode: want.mode });
    };
    ws.onmessage = function (ev) { handle(ev.data); };
    ws.onerror = function () {};
    ws.onclose = function () {
      clearTimeout(timeout);
      var wasConnected = connected;
      connected = false;
      stopPing();
      if (manualClose) { emit('close'); return; }
      if (want) {
        if (!wasConnected && connectCb) {
          var cb = connectCb;
          connectCb = null;
          cb(new Error('无法连接服务器：' + want.url + '（请确认已运行 node sector-server.js）'));
          want = null;
          return;
        }
        emit('close');
        scheduleReconnect();
      } else {
        emit('close');
      }
    };
  }

  function create(m, cb, url) {
    manualClose = false;
    mode = m;
    code = null;
    role = 'host';
    want = { type: 'create', mode: m, url: url || defaultUrl() };
    connectCb = cb;
    openSocket(want.url);
  }

  function join(roomCode, cb, url) {
    manualClose = false;
    code = (roomCode || '').toUpperCase().trim();
    want = { type: 'join', code: code, url: url || defaultUrl() };
    connectCb = cb;
    openSocket(want.url);
  }

  function close() {
    manualClose = true;
    want = null;
    clearTimeout(retryTimer);
    stopPing();
    if (ws && connected) sendRaw({ t: 'leave' });
    cleanupSocket();
    connected = false;
    role = null;
    mode = null;
    code = null;
    emit('close');
  }

  root.SectorNet = {
    create: create,
    join: join,
    send: sendMsg,
    sendState: function (st) { return sendMsg({ t: 'state', state: st }); },
    sendAction: function (name, args) { return sendMsg({ t: 'action', name: name, args: args }); },
    sendScore: function (sc) { return sendMsg({ t: 'score', score: sc }); },
    sendWin: function (info) { return sendMsg({ t: 'win', info: info }); },
    on: on,
    close: close,
    defaultUrl: defaultUrl,
    isHost: function () { return connected && role === 'host'; },
    isGuest: function () { return connected && role === 'guest'; },
    isConnected: function () { return connected; },
    mode: function () { return mode; },
    code: function () { return code; }
  };
})(window);
