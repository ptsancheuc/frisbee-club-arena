(() => {
  'use strict';
  const $ = id => document.getElementById(id), art = window.DogArt;
  let breed = 'mestizo';
  let pixels = art.make(), brush = '#cf9560', erasing = false, history = [], drawing = false, lastPixel = null, cursor = { x: 0, y: 0 }, showCursor = false;
  try { const saved = JSON.parse(localStorage.getItem('frisbee-profile-v2')); if (saved) { if (Object.hasOwn(art.breeds, saved.breed)) breed = saved.breed; if (art.valid(saved.skin)) pixels = saved.skin; if (saved.name) $('nickname').value = saved.name; } } catch (_) {}
  $('breed').value = breed;
  $('breed').onchange = () => { remember(); breed = $('breed').value; pixels = art.make('#cf9560', breed); drawEditor(); save(); };
  const board = $('pixel-board'), paint = board.getContext('2d'), preview = $('preview').getContext('2d');
  function save() {
    try { localStorage.setItem('frisbee-profile-v2', JSON.stringify({ name: $('nickname').value, skin: pixels, breed })); $('saved').textContent = 'Diseño guardado en este dispositivo. Todos podrán verlo en la sala.'; }
    catch (_) { $('saved').textContent = 'Diseño listo. Este navegador no permite guardarlo al cerrar.'; }
  }
  function drawEditor() {
    paint.clearRect(0, 0, 400, 320);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 20; x++) { paint.fillStyle = (x + y) % 2 ? '#e5ebd6' : '#f1f3e6'; paint.fillRect(x * 20, y * 20, 20, 20); }
    art.draw(paint, pixels, 0, 0, 20);
    paint.strokeStyle = '#60784b22'; paint.lineWidth = 1;
    for (let x = 0; x <= 400; x += 20) { paint.beginPath(); paint.moveTo(x, 0); paint.lineTo(x, 320); paint.stroke(); }
    for (let y = 0; y <= 320; y += 20) { paint.beginPath(); paint.moveTo(0, y); paint.lineTo(400, y); paint.stroke(); }
    if (showCursor) { paint.strokeStyle = '#ed744e'; paint.lineWidth = 3; paint.strokeRect(cursor.x * 20 + 2, cursor.y * 20 + 2, 16, 16); }
    preview.clearRect(0, 0, 100, 70); art.draw(preview, pixels, 10, 1, 4);
    $('undo').disabled = !history.length;
  }
  function remember() { history.push(pixels.slice()); if (history.length > 30) history.shift(); }
  function position(e) { const r = board.getBoundingClientRect(); return { x: Math.max(0, Math.min(19, Math.floor((e.clientX - r.left) / r.width * 20))), y: Math.max(0, Math.min(15, Math.floor((e.clientY - r.top) / r.height * 16))) }; }
  function stroke(pos) {
    const start = lastPixel || pos, steps = Math.max(Math.abs(pos.x - start.x), Math.abs(pos.y - start.y), 1);
    for (let i = 0; i <= steps; i++) pixels[Math.round(start.y + (pos.y - start.y) * i / steps) * 20 + Math.round(start.x + (pos.x - start.x) * i / steps)] = erasing ? null : brush;
    lastPixel = pos; cursor = pos; drawEditor();
  }
  board.addEventListener('pointerdown', e => { e.preventDefault(); remember(); drawing = true; showCursor = false; lastPixel = null; board.setPointerCapture(e.pointerId); stroke(position(e)); });
  board.addEventListener('pointermove', e => { if (drawing) stroke(position(e)); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) board.addEventListener(event, () => { if (drawing) save(); drawing = false; lastPixel = null; });
  board.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter'].includes(e.code)) return;
    e.preventDefault(); showCursor = true;
    cursor.x = Math.max(0, Math.min(19, cursor.x + (e.code === 'ArrowRight' ? 1 : e.code === 'ArrowLeft' ? -1 : 0)));
    cursor.y = Math.max(0, Math.min(15, cursor.y + (e.code === 'ArrowDown' ? 1 : e.code === 'ArrowUp' ? -1 : 0)));
    if (['Space', 'Enter'].includes(e.code)) { remember(); lastPixel = null; stroke(cursor); save(); } drawEditor();
  });
  function tool(erase) { erasing = erase; $('brush').setAttribute('aria-pressed', !erase); $('eraser').setAttribute('aria-pressed', erase); }
  $('brush').onclick = () => tool(false); $('eraser').onclick = () => tool(true);
  $('paint-color').oninput = e => { brush = e.target.value; tool(false); };
  for (const color of ['#cf9560', '#f4ddb0', '#73513b', '#293d35', '#ed744e', '#e5b64b', '#79ab9b', '#70aacf', '#ac8fc2', '#efabb4', '#ffffff']) {
    const button = document.createElement('button'); button.className = 'swatch'; button.style.background = color; button.setAttribute('aria-label', `Color ${color}`);
    button.onclick = () => { brush = color; $('paint-color').value = color; tool(false); }; $('palette').append(button);
  }
  $('undo').onclick = () => { if (history.length) { pixels = history.pop(); drawEditor(); save(); } };
  $('reset-skin').onclick = () => { remember(); pixels = art.make('#cf9560', breed); drawEditor(); save(); };
  $('recolor').onclick = () => { remember(); const base = art.make('#cf9560', breed); pixels = pixels.map((c, i) => base[i] === ({corgi:'#dca45f',dalmata:'#f3eee4',husky:'#8c9ba4',salchicha:'#9d6443'}[breed] || '#cf9560') ? brush : c); drawEditor(); save(); };
  $('fill-color').onclick = () => { remember(); pixels = pixels.map(c => c ? brush : null); drawEditor(); save(); };
  $('nickname').addEventListener('change', save); drawEditor();
  

  const canvas = $('world'), ctx = canvas.getContext('2d'), mini = $('minimap').getContext('2d');
  let session = null, events = null, timer = null, snapshot = null, rendered = new Map(), flying = new Map(), profiles = new Map(), keys = {}, joystick = { x: 0, y: 0 }, boosting = false, actions = [], seq = 0, inFlight = false, lastPacket = 0, joinedAt = 0, active = false, pendingJoin = false;
  let cw = 800, ch = 600, dpr = 1, camera = { x: 1200, y: 800 }, lastFrame = 0, zoom = 1, stickPointer = null;
  function resize() { const r = canvas.getBoundingClientRect(); if (!r.width) return; cw = r.width; ch = r.height; dpr = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
  window.addEventListener('resize', resize);
  function clearInput() { keys = {}; joystick = { x: 0, y: 0 }; boosting = false; actions = []; $('stick-knob').style.transform = ''; stickPointer = null; }
  function queue(action) { if (active && actions.length < 8) actions.push(action); }
  function direction() { return { x: joystick.x || ((keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0)), y: joystick.y || ((keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0)) }; }
  function doTrick() { const d = direction(); queue(d.x < -.25 ? 'backflip' : d.x > .25 ? 'spin' : 'flip'); }
  async function leave(message = '') {
    const previous = session; active = false; session = null; events?.close(); events = null; clearInterval(timer); timer = null; clearInput(); snapshot = null; rendered.clear(); flying.clear(); profiles.clear();
    document.body.classList.remove('fullscreen'); $('lobby').classList.remove('hidden'); $('arena').classList.add('hidden'); $('join-error').textContent = message; $('join').disabled = false;
    if (previous) fetch('/api/leave', { method: 'POST', headers: { Authorization: `Bearer ${previous.token}` }, keepalive: true }).catch(() => {});
  }
  async function sendInput() {
    if (!active || !session || inFlight) return;
    if (Date.now() - (lastPacket || joinedAt) > 15000) { leave('Se perdió la conexión. Tu diseño está guardado; vuelve a entrar.'); return; }
    const current = session, d = document.hidden ? { x: 0, y: 0 } : direction();
    inFlight = true;
    try {
      const response = await fetch('/api/input', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.token}` }, body: JSON.stringify({ seq: ++seq, ...d, boost: !document.hidden && (boosting || keys.ShiftLeft || keys.ShiftRight) === true, actions: actions.splice(0, 4) }), signal: AbortSignal.timeout(4000) });
      if (response.status === 401 && session === current) leave('La sesión terminó. Vuelve a entrar al parque.');
    } catch (_) { if (session === current) $('connection').textContent = 'Conexión inestable. Intentando recuperar la sala…'; }
    finally { inFlight = false; }
  }
  $('join-form').addEventListener('submit', async e => {
    e.preventDefault(); if (pendingJoin) return; pendingJoin = true; $('join').disabled = true; $('join-error').textContent = ''; save();
    try {
      const response = await fetch('/api/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: $('nickname').value, room: 'parque', breed, color: brush, skin: pixels }), signal: AbortSignal.timeout(8000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo entrar');
      session = data; active = true; seq = 0; lastPacket = 0; joinedAt = Date.now(); inFlight = false; clearInput();
      $('lobby').classList.add('hidden'); $('arena').classList.remove('hidden'); $('room-name').textContent = data.room; $('connection').textContent = 'Conectando con el parque…'; $('invite-link').classList.add('hidden');
      resize(); canvas.focus({ preventScroll: true }); historyUrl(data.room);
      const current = session; events = new EventSource('/api/events?token=' + encodeURIComponent(data.token));
      events.onmessage = event => {
        if (session !== current) return;
        try {
          const next = JSON.parse(event.data); lastPacket = Date.now();
          for (const p of next.players) { if (p.skin !== undefined) profiles.set(p.id, p.skin); p.skin = profiles.get(p.id) || null; }
          const live = new Set(next.players.map(p => p.id)); for (const id of rendered.keys()) if (!live.has(id)) { rendered.delete(id); profiles.delete(id); }
          if (!snapshot) { const me = next.players.find(p => p.id === session.id); if (me) camera = { x: me.x, y: me.y }; }
          snapshot = next; updateHud();
        } catch (_) { $('connection').textContent = 'Esperando un estado válido del servidor…'; }
      };
      events.onerror = () => { if (session === current) $('connection').textContent = 'Reconectando… Los controles se detienen si se pierde la conexión.'; };
      timer = setInterval(sendInput, 80); sendInput();
    } catch (error) { $('join-error').textContent = error.name === 'TimeoutError' ? 'El servidor no respondió. Inténtalo de nuevo.' : error.message; $('join').disabled = false; }
    finally { pendingJoin = false; }
  });
  function historyUrl(room) { const url = new URL(location.href); url.searchParams.set('room', room); window.history.replaceState(null, '', url); }
  $('pee').onclick = () => { queue('pee'); canvas.focus(); };
  $('leave').onclick = () => leave();
  $('expand').onclick = () => { document.body.classList.toggle('fullscreen'); $('expand').textContent = document.body.classList.contains('fullscreen') ? 'Reducir' : 'Ampliar'; resize(); };
  $('invite').onclick = async () => {
    if (!session) return; const url = new URL(location.href); url.search = ''; url.searchParams.set('room', session.room);
    const text = url.toString(); $('invite-link').textContent = text; $('invite-link').classList.remove('hidden');
    try { await navigator.clipboard.writeText(text); $('connection').textContent = 'Invitación copiada. Compártela con tus amigos.'; }
    catch (_) { $('connection').textContent = 'Copia el enlace que aparece debajo del juego.'; }
  };
  window.addEventListener('keydown', e => {
    if (!active || /INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyX', 'KeyZ', 'KeyE', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault(); keys[e.code] = true;
    if (!e.repeat && e.code === 'Space') queue('jump');
    if (!e.repeat && e.code === 'KeyX') doTrick();
    if (!e.repeat && e.code === 'KeyZ') queue('grab');
    if (!e.repeat && e.code === 'KeyE') queue('pee');
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', clearInput); document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); sendInput(); } });
  window.addEventListener('pagehide', () => { if (session) fetch('/api/leave', { method: 'POST', headers: { Authorization: `Bearer ${session.token}` }, keepalive: true }).catch(() => {}); });
  const stick = $('joystick');
  function moveStick(e) { const r = stick.getBoundingClientRect(), x = (e.clientX - r.left - r.width / 2) / 34, y = (e.clientY - r.top - r.height / 2) / 34, length = Math.max(1, Math.hypot(x, y)); joystick = { x: x / length, y: y / length }; $('stick-knob').style.transform = `translate(${joystick.x * 28}px,${joystick.y * 28}px)`; }
  stick.addEventListener('pointerdown', e => { e.preventDefault(); if (stickPointer !== null) return; stickPointer = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === stickPointer) moveStick(e); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(event, e => { if (e.pointerId === stickPointer) { stickPointer = null; joystick = { x: 0, y: 0 }; $('stick-knob').style.transform = ''; } });
  for (const [id, action] of [['mobile-jump', () => queue('jump')], ['mobile-spin', doTrick], ['mobile-grab', () => queue('grab')]]) $(id).addEventListener('pointerdown', e => { e.preventDefault(); action(); });
  $('mobile-boost').addEventListener('pointerdown', e => { e.preventDefault(); boosting = true; e.currentTarget.setPointerCapture(e.pointerId); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('mobile-boost').addEventListener(event, () => boosting = false);
  function updateHud() {
    const me = snapshot.players.find(p => p.id === session.id); if (!me) return;
    const water = Math.ceil(me.water);
    $('water-meter').value = me.water; $('water-value').textContent = water + '%';
    $('water-meter').parentElement.classList.toggle('low', water < 25);
    $('water-hint').textContent = me.drinking ? (water < 100 ? 'Tomando agua…' : '¡Agua completa!') : water < 25 ? '¡Tienes sed! Busca un bebedero azul.' : 'Detente junto a un bebedero para beber.';
    $('pee').disabled = me.peeCooldown > 0 || me.z > 0;
    $('pee-timer').textContent = me.peeing > 0 ? '¡VULNERABLE! ' + Math.ceil(me.peeing) + ' s' : 'Mear obligatorio en ' + Math.ceil(me.peeIn) + ' s';
    $('pee-timer').classList.toggle('urgent', me.peeing > 0 || me.peeIn < 8);
    $('pee').textContent = me.peeing > 0 ? 'MARCANDO…' : me.peeCooldown > 0 ? 'MEAR · ' + Math.ceil(me.peeCooldown) + ' s' : 'MEAR · E';
    $('mass').textContent = Math.floor(me.mass); $('points').textContent = me.score; $('tags').textContent = me.tags;
    const humans = snapshot.players.filter(p => !p.bot).length, bots = snapshot.players.filter(p => p.bot).length;
    $('population').textContent = `${humans} / 24 jugadores · ${bots} bots`;
    $('connection').textContent = `Conectado · ${humans} jugador${humans === 1 ? '' : 'es'} y ${bots} bots. Los perros con IA compiten con las mismas reglas.`;
    $('notice').textContent = me.notice || (me.shield > 0 ? `Protección: ${Math.ceil(me.shield)} s` : '');
    $('air-hud').textContent = me.trick || me.pending ? `${me.airNames.join(' + ')}${me.trick ? ' · TRUCO EN CURSO' : ''} · ${me.pending} pts por aterrizar` : '';
    const fragment = document.createDocumentFragment();
    for (const p of [...snapshot.players].sort((a, b) => b.mass - a.mass || b.score - a.score).slice(0, 5)) {
      const li = document.createElement('li'), points = document.createElement('span'); li.className = p.id === session.id ? 'me' : ''; li.append(document.createTextNode(p.name.slice(0, 12) + (p.bot ? ' · IA' : ''))); points.textContent = Math.floor(p.mass); li.append(points); fragment.append(li);
    } $('ranking').replaceChildren(fragment);
  }
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  function ellipse(x, y, rx, ry, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  function drawDog(p, t) {
    const r = 17 + Math.sqrt(p.mass) * 2.9, size = r / 11;
    ellipse(p.x, p.y + 4, r, r * .37, '#3d57352d');
    ctx.save(); ctx.strokeStyle = p.id === session.id ? '#ec8053' : '#78916788'; ctx.lineWidth = 2; if (p.shield > 0) { ctx.setLineDash([5, 5]); ctx.strokeStyle = '#fefde5'; ctx.lineWidth = 3; }
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * .65, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(p.x, p.y - p.z * .65); ctx.scale(p.facing, 1);
    if (p.trick) {
      const progress = Math.min(1, p.trick.t / ({ spin: .35, flip: .4, backflip: .4, grab: .25 }[p.trick.id] || .4)); ctx.translate(0, -8 * size);
      if (p.trick.id === 'spin') ctx.scale(Math.cos(progress * Math.PI * 2), 1); else if (p.trick.id === 'grab') ctx.scale(1.15, .75); else ctx.rotate(progress * Math.PI * 2 * (p.trick.id === 'backflip' ? -1 : 1)); ctx.translate(0, 8 * size);
    }
    if (p.peeing > 0) { ctx.rotate(-.12); rect(-8 * size, -7 * size, 6 * size, 2 * size, p.color); }
    art.draw(ctx, p.skin || art.make(p.color, p.breed), -10 * size, -16 * size + Math.sin(t * 5 + p.x) * 1.3, size); ctx.restore();
    const label = `${p.name}${p.bot ? ' · IA' : p.id === session.id ? ' · TÚ' : ''}`;
    ctx.font = '600 12px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#f5f3e9'; ctx.strokeText(label, p.x, p.y - p.z * .65 - 16 * size - 12); ctx.fillStyle = '#30452d'; ctx.fillText(label, p.x, p.y - p.z * .65 - 16 * size - 12);
    if (p.peeing > 0) for (let i=0;i<5;i++) rect(p.x - p.facing * (12+i*4), p.y - 12 + i*4 + Math.sin(t*18+i)*2, 3, 3, '#ddbd49');
    if (p.drinking) { ctx.fillStyle='#318baa'; ctx.font='bold 12px sans-serif'; ctx.fillText('GLUP',p.x,p.y-65-p.z*.65); }
    if (p.scared > 0) { ctx.font = 'bold 24px monospace'; ctx.fillStyle = '#c35f43'; ctx.fillText('!', p.x + r, p.y - 50); }
  }
  function render(now) {
    const dt = Math.min(.05, (now - lastFrame) / 1000 || .016); lastFrame = now;
    if (active && snapshot && session) {
      const me = snapshot.players.find(p => p.id === session.id);
      if (me) {
        for (const p of snapshot.players) {
          const previous = rendered.get(p.id) || { ...p }, mix = Math.min(1, dt * 16), distance = Math.hypot(p.x - previous.x, p.y - previous.y);
          rendered.set(p.id, { ...p, x: distance > 250 ? p.x : previous.x + (p.x - previous.x) * mix, y: distance > 250 ? p.y : previous.y + (p.y - previous.y) * mix, z: previous.z + (p.z - previous.z) * mix, mass: previous.mass + (p.mass - previous.mass) * Math.min(1, dt * 5) });
        }
        const mine = rendered.get(me.id);
        zoom = (cw < 600 ? .72 : .95) / (1 + Math.max(0, Math.sqrt(mine.mass) - 7) / 50);
        const edgeX = cw / (2 * zoom), edgeY = ch / (2 * zoom);
        const targetX = Math.max(edgeX, Math.min(snapshot.width - edgeX, mine.x)), targetY = Math.max(edgeY, Math.min(snapshot.height - edgeY, mine.y));
        camera.x += (targetX - camera.x) * Math.min(1, dt * 9); camera.y += (targetY - camera.y) * Math.min(1, dt * 9);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cw, ch); rect(0, 0, cw, ch, '#a9bb87');
        ctx.save(); ctx.translate(cw / 2, ch / 2); ctx.scale(zoom, zoom); ctx.translate(-camera.x, -camera.y);
        rect(0, 0, snapshot.width, snapshot.height, '#dce6bd');
        ctx.strokeStyle = '#a8bd841e'; ctx.lineWidth = 1;
        for (let x = 0; x <= snapshot.width; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, snapshot.height); ctx.stroke(); }
        for (let y = 0; y <= snapshot.height; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(snapshot.width, y); ctx.stroke(); }
        for (let i = 0; i < 300; i++) { const x = (i * 137 + 37) % snapshot.width, y = (i * 293 + 57) % snapshot.height; rect(x, y, 3, 6, '#b6c98f'); rect(x - 3, y + 3, 9, 2, i % 7 ? '#b6c98f' : '#f5e9b5'); }
        ctx.strokeStyle = '#819968'; ctx.lineWidth = 7; ctx.strokeRect(0, 0, snapshot.width, snapshot.height);
        ctx.font = '700 70px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#b5c89055'; ctx.fillText('FRISBEE CLUB', 1200, 810);
        for (const puddle of snapshot.puddles || []) { ctx.save(); ctx.globalAlpha=Math.min(.55,(puddle.expires-snapshot.time)/4); ellipse(puddle.x,puddle.y,22,9,'#d4b957'); ctx.restore(); }
        for (const b of snapshot.bowls || []) {
          ellipse(b.x,b.y,72,38,'#70bdd31a');
          rect(b.x-29,b.y-8,58,22,'#6e8991'); rect(b.x-24,b.y-12,48,20,'#c4d7d5');
          rect(b.x-20,b.y-9,40,13,'#4ba6c6'); rect(b.x-13+Math.sin(now/350)*4,b.y-6,17,3,'#b9eff1');
          ctx.font='bold 10px sans-serif'; ctx.textAlign='center'; ctx.fillStyle='#36788d'; ctx.fillText('AGUA',b.x,b.y+29);
        }
        const liveDiscs = new Set(snapshot.discs.map(f => f.id));
        for (const id of flying.keys()) if (!liveDiscs.has(id)) flying.delete(id);
        for (const target of snapshot.discs) {
          const previous = flying.get(target.id) || target, mix = Math.min(1, dt * 16);
          const f = { ...target, x: previous.x + (target.x - previous.x) * mix, y: previous.y + (target.y - previous.y) * mix, height: previous.height + (target.height - previous.height) * mix };
          flying.set(f.id, f);
          ellipse(f.x, f.y, 13, 5, '#6e845b1e'); const fy = f.y - f.height * .65 + Math.sin(now / 420 + f.id) * 2;
          for (let i = 1; i <= 3; i++) {
            const bend = f.path === 'curve' ? f.turn * i * .12 : f.path === 'wave' ? Math.cos(f.age * 1.6 + f.phase) * i * .13 : 0;
            rect(f.x - Math.cos(f.angle - bend) * i * 13, fy - Math.sin(f.angle - bend) * i * 13, 5 - i, 3, '#fff9dd99');
          }
          rect(f.x - 13, fy, 26, 5, f.value === 8 ? '#bb8c29' : f.high ? '#428d9a' : '#bf613f'); rect(f.x - 10, fy - 3, 20, 5, f.value === 8 ? '#ebc656' : f.high ? '#83cbd0' : '#f39264'); rect(f.x - 5, fy - 2, 10, 2, '#ffe8ae');
          if (f.value === 8) { rect(f.x + 16, fy - 5, 3, 3, '#e6bb43'); }
        }
        for (const c of snapshot.cats) {
          if (c.warning) { ctx.save(); ctx.strokeStyle = '#ce785099'; ctx.setLineDash([8, 8]); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, 110, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
          ellipse(c.x, c.y, 17, 6, '#4c525a26'); rect(c.x - 13, c.y - 22, 26, 18, '#76758b'); rect(c.x - 15, c.y - 36, 20, 17, '#76758b'); rect(c.x - 15, c.y - 42, 5, 8, '#76758b'); rect(c.x, c.y - 42, 5, 8, '#76758b'); rect(c.x - 12, c.y - 30, 4, 3, '#f5d789'); rect(c.x - 3, c.y - 30, 4, 3, '#f5d789'); rect(c.x + 12, c.y - 30, 5, 20, '#76758b');
        }
        [...rendered.values()].sort((a, b) => a.y - b.y).forEach(p => drawDog(p, now / 1000)); ctx.restore();
        mini.clearRect(0, 0, 180, 120); mini.fillStyle = '#dfe8c6'; mini.fillRect(0, 0, 180, 120);
        mini.fillStyle='#258da9'; for (const b of snapshot.bowls || []) mini.fillRect(b.x/snapshot.width*180-2,b.y/snapshot.height*120-2,4,4);
        for (const p of snapshot.players) { mini.fillStyle = p.id === session.id ? '#ed744e' : '#526d49'; mini.beginPath(); mini.arc(p.x / snapshot.width * 180, p.y / snapshot.height * 120, p.id === session.id ? 4 : 2.5, 0, Math.PI * 2); mini.fill(); }
        if (Date.now() - lastPacket > 1500) $('connection').textContent = 'Conexión lenta: esperando al servidor…';
      }
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
