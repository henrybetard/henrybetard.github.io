// 《第七区》联机服务器：零依赖 Node（14+）
// 运行：node sector-server.js   浏览器打开 http://localhost:8787/sector.html
// 作用：静态文件 + WebSocket 房间转发（合作模式房主权威，对抗模式各跑各的、互相发比分）
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8787;
const ROOT = __dirname;
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MSG = 128 * 1024;

const rooms = new Map();   // code -> { code, mode, conns: [conn...], host: conn }
const allConns = new Set();

function frame(op, payload) {
  const p = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  let h;
  if (p.length < 126) h = Buffer.from([0x80 | op, p.length]);
  else if (p.length < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(p.length, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(p.length), 2); }
  return Buffer.concat([h, p]);
}
function send(conn, obj) {
  if (!conn || conn.closed) return;
  try { conn.sock.write(frame(1, JSON.stringify(obj))); } catch (e) {}
}
function others(room, conn) {
  return (room.conns || []).filter(c => c !== conn && !c.closed);
}
function broadcast(room, obj, except) {
  for (const c of others(room, except)) send(c, obj);
}
function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}
function leaveRoom(conn) {
  const room = conn.room;
  if (!room) return;
  room.conns = (room.conns || []).filter(c => c !== conn);
  conn.room = null;
  broadcast(room, { t: 'peer', joined: false });
  if (room.conns.length === 0) rooms.delete(room.code);
  else if (room.host === conn) room.host = room.conns[0];
}

function handle(conn, msg) {
  if (!msg || typeof msg.t !== 'string') return;
  if (msg.t === 'ping') { send(conn, { t: 'pong' }); return; }

  if (msg.t === 'create') {
    if (conn.room) leaveRoom(conn);
    const mode = msg.mode === 'versus' ? 'versus' : 'coop';
    const code = makeCode();
    const room = { code, mode, conns: [conn], host: conn };
    rooms.set(code, room);
    conn.room = room;
    send(conn, { t: 'room', code, host: true, mode });
    return;
  }

  if (msg.t === 'join') {
    const code = String(msg.code || '').trim().toUpperCase().slice(0, 8);
    const room = rooms.get(code);
    if (!room) return send(conn, { t: 'error', msg: '房间不存在' });
    if (room.conns.length >= 2) return send(conn, { t: 'error', msg: '房间已满（最多 2 人）' });
    if (conn.room) leaveRoom(conn);
    room.conns.push(conn);
    conn.room = room;
    send(conn, { t: 'room', code, host: false, mode: room.mode });
    broadcast(room, { t: 'peer', joined: true }, conn);
    return;
  }

  // 断线重连：同一角色重新占位
  if (msg.t === 'rejoin') {
    const code = String(msg.code || '').trim().toUpperCase().slice(0, 8);
    const room = rooms.get(code);
    if (!room) return send(conn, { t: 'error', msg: '房间已关闭' });
    if (conn.room) leaveRoom(conn);
    if (room.conns.length >= 2) return send(conn, { t: 'error', msg: '房间已满' });
    room.conns.push(conn);
    conn.room = room;
    if (msg.role === 'host' && !room.host) room.host = conn;
    send(conn, { t: 'room', code, host: room.host === conn, mode: room.mode });
    broadcast(room, { t: 'peer', joined: true }, conn);
    return;
  }

  if (msg.t === 'msg') {
    const room = conn.room;
    if (!room) return;
    broadcast(room, { t: 'msg', from: conn.id, data: msg.data }, conn);
    return;
  }

  if (msg.t === 'leave') { leaveRoom(conn); send(conn, { t: 'left' }); return; }
}

/* ---------------- 静态文件 ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon' };
function serve(req, res) {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}
const server = http.createServer(serve);

/* ---------------- WebSocket ---------------- */
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || String(req.headers.upgrade).toLowerCase() !== 'websocket') { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const conn = { id: 'c' + Math.random().toString(36).slice(2, 10), sock: socket, closed: false, room: null, alive: true };
  allConns.add(conn);
  let buf = Buffer.alloc(0), frags = [];
  const close = () => {
    if (conn.closed) return;
    conn.closed = true;
    allConns.delete(conn);
    leaveRoom(conn);
    try { socket.destroy(); } catch (e) {}
  };
  conn.kill = close;

  socket.on('data', d => {
    conn.alive = true;
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 2) {
      const fin = !!(buf[0] & 0x80), op = buf[0] & 0x0f, masked = !!(buf[1] & 0x80);
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_MSG) return close();
      const mlen = masked ? 4 : 0;
      if (buf.length < off + mlen + len) return;
      let payload = Buffer.from(buf.slice(off + mlen, off + mlen + len));
      if (masked) { const mk = buf.slice(off, off + 4); for (let i = 0; i < payload.length; i++) payload[i] ^= mk[i & 3]; }
      buf = buf.slice(off + mlen + len);
      if (op === 8) { try { socket.write(frame(8, Buffer.alloc(0))); } catch (e) {} return close(); }
      if (op === 9) { try { socket.write(frame(10, payload)); } catch (e) {} continue; }
      if (op === 10) continue;
      if (op === 1 || op === 0) {
        frags.push(payload);
        if (fin) {
          const text = Buffer.concat(frags).toString('utf8'); frags = [];
          let m = null; try { m = JSON.parse(text); } catch (e) {}
          try { handle(conn, m); } catch (e) { console.error('handle error', e); }
        }
      }
    }
  });
  socket.on('close', close);
  socket.on('error', close);
  socket.on('timeout', close);
});

setInterval(() => {
  for (const conn of [...allConns]) {
    if (!conn.alive) { conn.kill(); continue; }
    conn.alive = false;
    try { conn.sock.write(frame(9, Buffer.alloc(0))); } catch (e) { conn.kill(); }
  }
}, 20000);

server.listen(PORT, () => {
  console.log('《第七区》联机服务器已启动：http://localhost:' + PORT + '/sector.html');
  console.log('局域网内其他人访问：http://<本机IP>:' + PORT + '/sector.html');
});
