const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Arena } = require('./arena-core.cjs');
const rooms = new Map(), sessions = new Map(), streams = new Map(), limits = new Map();
const publicFiles = new Set(['index.html', 'solo.html', 'style.css', 'game.js', 'arena.css', 'arena.js', 'sprite.js']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
async function body(req) { let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 16000) throw new Error('Solicitud demasiado grande'); } return JSON.parse(text || '{}'); }
function auth(req) { return sessions.get((req.headers.authorization || '').replace(/^Bearer /, '')); }
function drop(token) { const s = sessions.get(token); if (!s) return; s.room.players.delete(s.player.id); sessions.delete(token); streams.get(token)?.end(); streams.delete(token); }
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { return json(res, 400, { error: 'URL inválida' }); }
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method === 'POST' && req.headers.origin && ![ `http://${req.headers.host}`, `https://${req.headers.host}` ].includes(req.headers.origin)) return json(res, 403, { error: 'Origen no permitido' });
  try {
    if (url.pathname === '/health') return json(res, 200, { ok: true, rooms: rooms.size, players: sessions.size });
    if (url.pathname === '/api/join' && req.method === 'POST') {
      const ip = req.socket.remoteAddress, now = Date.now(), limit = limits.get(ip) || { count: 0, start: now };
      if (now - limit.start > 60000) { limit.count = 0; limit.start = now; }
      if (++limit.count > 30) return json(res, 429, { error: 'Demasiadas entradas. Espera un minuto.' }); limits.set(ip, limit);
      const data = await body(req), code = 'parque';
      if (!rooms.has(code)) { if (rooms.size >= 40) return json(res, 503, { error: 'Servidor lleno. Inténtalo más tarde.' }); const arena = new Arena(code); arena.addBots(); rooms.set(code, arena); }
      const room = rooms.get(code), player = room.join(data); sessions.set(player.token, { room, player });
      return json(res, 200, { token: player.token, id: player.id, room: code });
    }
    if (url.pathname === '/api/events' && req.method === 'GET') {
      const token = url.searchParams.get('token'), s = sessions.get(token);
      if (!s) return json(res, 401, { error: 'Sesión terminada. Vuelve a entrar.' });
      streams.get(token)?.end(); streams.set(token, res); s.player.connected = true; s.player.lastSeen = Date.now();
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      const initial = s.room.snapshot(); s.profileIds = initial.players.map(p => p.id).join(',');
      res.write(`data: ${JSON.stringify(initial)}\n\n`);
      req.on('close', () => { if (streams.get(token) === res) { streams.delete(token); s.player.connected = false; } }); return;
    }
    if (url.pathname === '/api/input' && req.method === 'POST') {
      const s = auth(req); if (!s) return json(res, 401, { error: 'Sesión terminada' });
      const now = Date.now(); if (now - (s.lastPacket || 0) < 25) return json(res, 429, { error: 'Demasiados comandos' });
      s.lastPacket = now; s.room.input(s.player, await body(req)); return json(res, 200, { ok: true });
    }
    if (url.pathname === '/api/leave' && req.method === 'POST') { const s = auth(req); if (s) drop(s.player.token); return json(res, 200, { ok: true }); }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Método no permitido' });
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!publicFiles.has(file)) return json(res, 404, { error: 'No encontrado' });
    res.setHeader('Content-Type', types[path.extname(file)]); res.setHeader('Cache-Control', 'no-cache');
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(path.join(__dirname, file)).on('error', () => { if (!res.headersSent) res.writeHead(404); res.end(); }).pipe(res);
  } catch (error) { json(res, 400, { error: error.message || 'Solicitud inválida' }); }
});
let tick = 0;
const timer = setInterval(() => {
  for (const room of rooms.values()) { if ([...room.players.values()].some(p => !p.bot)) { room.step(.05); room.lastActive = Date.now(); } }
  if (++tick % 2 === 0) {
    const snapshots = new Map();
    for (const [token, res] of streams) {
      const session = sessions.get(token); if (!session || res.writableEnded || res.destroyed) continue;
      if (!snapshots.has(session.room.code)) {
        const full = session.room.snapshot(), ids = full.players.map(p => p.id).join(',');
        const light = { ...full, players: full.players.map(({ skin, ...p }) => p) };
        snapshots.set(session.room.code, { ids, full: `data: ${JSON.stringify(full)}\n\n`, light: `data: ${JSON.stringify(light)}\n\n` });
      }
      if (res.writableLength > 256000) { res.end(); streams.delete(token); continue; }
      const data = snapshots.get(session.room.code); res.write(session.profileIds === data.ids ? data.light : data.full); session.profileIds = data.ids;
    }
  }
  if (tick % 100 === 0) {
    const now = Date.now();
    for (const [token, s] of sessions) if (now - s.player.lastSeen > 20000) drop(token);
    for (const [code, room] of rooms) if (![...room.players.values()].some(p => !p.bot) && now - room.lastActive > 60000) rooms.delete(code);
    for (const [ip, limit] of limits) if (now - limit.start > 60000) limits.delete(ip);
  }
}, 50);
server.on('close', () => clearInterval(timer));
if (require.main === module) server.listen(process.env.PORT || 3000, process.env.HOST || '0.0.0.0', () => console.log('Frisbee Club Arena: puerto ' + (process.env.PORT || 3000)));
module.exports = { server, rooms, sessions, drop };
