(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  let W = 960;
  const H = 420, ground = 346;
  let state = 'ready', score = 0, best = 0, remaining = 60, elapsed = 0, spawn = .7, streak = 0;
  let frisbees = [], particles = [], popups = [], keys = {}, sound = false, audio, last = 0, sceneTime = 0;
  let obstacles = [], obstacleSpawn = 7, caught = 0, maxStreak = 0, timeBonus = 0, slow = 0, invulnerable = 0, stage = 1;
  const stageNames = ['PASEO TRANQUILO', 'COGIENDO VUELO', '¡A TODA PATA!', 'PARQUE SALVAJE', 'MODO LEYENDA'];
  let cats = [], catSpawn = 11, scared = 0, air = null, activeTrick = null, bestTrick = 0, landedTricks = 0, trickMessage = '', trickMessageTime = 0;
  const trickDefs = {
    spin: { name: 'Giro 360', points: 60, duration: .32 },
    flip: { name: 'Voltereta', points: 80, duration: .4 },
    backflip: { name: 'Backflip', points: 90, duration: .4 },
    grab: { name: 'Agarre de patitas', points: 40, duration: .24 }
  };
  function difficulty(seconds = elapsed) {
    const p = Math.min(1.2, seconds / 60);
    return { speed: 175 + p * 150, interval: 1.5 - p * .65, mudSpeed: 110 + p * 80, mudInterval: 7 - p * 3.5, catInterval: 13 - p * 6, catSpeed: 220 + p * 95, wave: 6 + p * 20 };
  }
  function newAir() { return { names: [], ids: [], points: 0, catches: 0, special: false, failed: false }; }
  function trick(id) {
    if (state !== 'playing' || dog.jumps === 0 || scared > 0 || activeTrick || air?.failed) return false;
    air ||= newAir();
    if (air.ids.length >= 5) return false;
    const def = trickDefs[id]; if (!def) return false;
    activeTrick = { id, time: 0, duration: def.duration };
    tone(470 + air.ids.length * 100, .08, 'triangle');
    return true;
  }
  function directionalTrick() { return trick(keys.ArrowLeft || keys.KeyA ? 'backflip' : keys.ArrowRight || keys.KeyD ? 'spin' : 'flip'); }
  function airValue() { return air ? (air.points + air.catches * 25) * Math.min(5, new Set(air.ids).size + (air.special ? 1 : 0)) : 0; }
  function trickFeedback(text) { trickMessage = text; trickMessageTime = 1.8; }
  function bail(reason) {
    if (air && (air.ids.length || activeTrick)) trickFeedback(`${reason} · COMBO PERDIDO`);
    if (air) { air.failed = true; air.points = 0; }
    activeTrick = null;
  }
  function land() {
    if (!air) return;
    if (activeTrick) bail('GIRO SIN TERMINAR');
    if (!air.failed && air.ids.length) {
      const bonus = airValue(); score += bonus; bestTrick = Math.max(bestTrick, bonus); landedTricks += air.ids.length;
      trickFeedback(`¡ATERRIZAJE LIMPIO! +${bonus}`);
      popups.push({ x: Math.max(10, Math.min(W - 150, dog.x - 45)), y: dog.y - 65, life: 1.3, text: `TRUCOS +${bonus}` });
      tone(1046, .16, 'triangle', .05);
    }
    air = null; activeTrick = null;
  }
  function updateTricks(dt) {
    trickMessageTime = Math.max(0, trickMessageTime - dt);
    if (!activeTrick) return;
    activeTrick.time += dt;
    if (activeTrick.time >= activeTrick.duration) {
      const id = activeTrick.id, def = trickDefs[id];
      const repeats = air.ids.filter(value => value === id).length;
      air.points += Math.max(10, Math.round(def.points / (repeats + 1)));
      air.ids.push(id); air.names.push(def.name);
      if (!air.special && air.ids.slice(-3).join(',') === 'spin,grab,backflip') {
        air.special = true; air.points += 200; air.names.push('¡HUESO DE ORO!');
      }
      activeTrick = null;
    }
  }
  const multiplier = () => Math.min(4, 1 + Math.floor(streak / 3));
  const dog = { x: 230, y: ground, vy: 0, jumps: 0, facing: 1 };
  function resize() {
    W = Math.round(H * $('screen').clientWidth / $('screen').clientHeight);
    canvas.width = W;
    dog.x = Math.max(35, Math.min(W - 40, dog.x));
  }
  window.addEventListener('resize', resize);
  resize();
  try { best = Number(localStorage.getItem('frisbee-club-best')) || 0; } catch (_) {}
  $('best').textContent = String(best).padStart(3, '0');
  function tone(freq, duration = .09, type = 'square', volume = .025) {
    if (!sound) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, audio.currentTime);
      gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
      osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
    } catch (_) {}
  }
  function updateHud() {
    $('score').textContent = String(score).padStart(3, '0'); $('time').textContent = Math.ceil(remaining);
    document.querySelector('.time-stat').classList.toggle('urgent', remaining <= 10);
    $('level').textContent = `0${stage} · ${stageNames[stage - 1]}`;
    $('multiplier').textContent = `COMBO ×${multiplier()}`;
    $('round-progress').style.width = `${Math.min(100, elapsed / (60 + timeBonus) * 100)}%`;
    const doingTricks = air && !air.failed && (air.ids.length || activeTrick);
    $('trick-hud').classList.toggle('hidden', !doingTricks && trickMessageTime <= 0);
    $('trick-name').textContent = doingTricks ? [...air.names, ...(activeTrick ? [trickDefs[activeTrick.id].name + '…'] : [])].join(' + ') : trickMessage;
    $('trick-points').textContent = doingTricks ? `${airValue()} pts EN JUEGO · ${activeTrick ? 'TERMINA EL GIRO' : 'ATERRIZA PARA COBRAR'}` : '';
    const warning = cats.find(c => c.warning > 0);
    $('hazard').textContent = warning ? (warning.direction < 0 ? '¡MIAU! GATO POR LA DERECHA →' : '← ¡MIAU! GATO POR LA IZQUIERDA') : scared > 0 ? '¡QUÉ SUSTO! RECUPERANDO EL EQUILIBRIO…' : '';
  }
  function start() {
    state = 'playing'; score = 0; remaining = 60; elapsed = 0; spawn = .6; streak = 0;
    frisbees = []; particles = []; popups = []; keys = {};
    obstacles = []; obstacleSpawn = 7; caught = 0; maxStreak = 0; timeBonus = 0; slow = 0; invulnerable = 0; stage = 1;
    cats = []; catSpawn = 11; scared = 0; air = null; activeTrick = null; bestTrick = 0; landedTricks = 0; trickMessageTime = 0;
    $('result-stats').classList.add('hidden');
    Object.assign(dog, { x: 230, y: ground, vy: 0, jumps: 0, facing: 1 });
    $('overlay').classList.add('hidden'); $('pause').classList.remove('hidden'); $('combo').textContent = '';
    $('status').innerHTML = '¡A POR ESE FRISBEE! <i></i>'; updateHud(); tone(440); canvas.focus({ preventScroll: true });
  }
  function jump() {
    if (state === 'ready' || state === 'over') { start(); return; }
    if (state !== 'playing' || dog.jumps >= 2) return;
    if (scared > 0) return;
    if (dog.jumps === 0) air = newAir();
    dog.vy = dog.jumps === 0 ? -490 : -425; dog.jumps++;
    tone(dog.jumps === 1 ? 420 : 620, .12);
    for (let i = 0; i < 6; i++) particles.push({ x: dog.x, y: dog.y, vx: (Math.random() - .5) * 90, vy: -Math.random() * 75, life: .35, color: '#e7dfb0' });
  }
  function setOverlay(caption, title, text, label, hint) {
    $('overlay-caption').textContent = caption; $('overlay-title').textContent = title; $('overlay-text').textContent = text;
    $('play-label').textContent = label; $('start-hint').textContent = hint; $('overlay').classList.remove('hidden');
  }
  function pause() {
    if (state === 'playing') {
      state = 'paused'; keys = {};
      setOverlay('UN RESPIRO', 'Pausa para olfatear.', 'Tus frisbees pueden esperar un momento.', 'SEGUIR', 'PULSA P O ESC PARA CONTINUAR');
      $('pause').setAttribute('aria-label', 'Continuar juego'); $('status').textContent = 'PAUSA PARA OLFATEAR';
    } else if (state === 'paused') {
      state = 'playing'; $('overlay').classList.add('hidden'); $('pause').setAttribute('aria-label', 'Pausar juego'); $('status').innerHTML = '¡A POR ESE FRISBEE! <i></i>'; canvas.focus({ preventScroll: true });
    }
  }
  function finish() {
    if (air && !air.failed && (air.ids.length || activeTrick)) bail('SE ACABÓ EL TIEMPO');
    air = null; activeTrick = null;
    state = 'over'; keys = {}; const record = score > best;
    if (record) { best = score; try { localStorage.setItem('frisbee-club-best', best); } catch (_) {} }
    $('best').textContent = String(best).padStart(3, '0'); $('pause').classList.add('hidden'); $('combo').textContent = '';
    const rank = score >= 700 ? 'Leyenda del parque' : score >= 350 ? 'As del frisbee' : score >= 150 ? 'Sabueso en ascenso' : 'Explorador de patitas';
    setOverlay(record ? '¡NUEVO RÉCORD!' : '¡MUY BUEN CHICO!', rank, `¡${score} puntos! ${caught ? 'Te ganaste una buena siesta.' : 'El próximo frisbee lleva tu nombre.'}`, 'OTRA RONDA', 'PULSA ESPACIO PARA VOLVER A JUGAR');
    $('result-stats').innerHTML = `<div><strong>${caught}</strong><span>ATRAPADOS</span></div><div><strong>${landedTricks}</strong><span>TRUCOS</span></div><div><strong>${bestTrick}</strong><span>MEJOR COMBO</span></div>`;
    $('result-stats').classList.remove('hidden');
    $('status').textContent = 'UNA RONDA MÁS, POR FAVOR'; tone(660, .25, 'triangle');
  }
  $('play').addEventListener('click', () => state === 'paused' ? pause() : start());
  $('pause').addEventListener('click', pause);
  $('sound').addEventListener('click', () => { sound = !sound; $('sound').setAttribute('aria-pressed', sound); $('sound').setAttribute('aria-label', sound ? 'Desactivar sonido' : 'Activar sonido'); $('sound-label').textContent = sound ? 'SONIDO ON' : 'SONIDO OFF'; tone(540); if (state === 'playing') canvas.focus({ preventScroll: true }); });
  window.addEventListener('keydown', e => {
    if ((e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) && e.code === 'Space') return;
    if (['Space', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'KeyW', 'KeyX', 'KeyZ', 'KeyP', 'Escape'].includes(e.code)) e.preventDefault();
    keys[e.code] = true;
    if (!e.repeat && ['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { if (state === 'paused') pause(); else jump(); }
    if (!e.repeat && ['KeyP', 'Escape'].includes(e.code)) pause();
    if (!e.repeat && e.code === 'KeyX') directionalTrick();
    if (!e.repeat && e.code === 'KeyZ') trick('grab');
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { keys = {}; if (state === 'playing') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });
  ['left', 'right'].forEach(id => {
    const b = $(id), key = id === 'left' ? 'ArrowLeft' : 'ArrowRight';
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); keys[key] = true; });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(event => b.addEventListener(event, () => keys[key] = false));
  });
  $('jump').addEventListener('pointerdown', e => { e.preventDefault(); jump(); });
  $('trick-spin').addEventListener('pointerdown', e => { e.preventDefault(); directionalTrick(); });
  $('trick-grab').addEventListener('pointerdown', e => { e.preventDefault(); trick('grab'); });
  // All scenery and sprites are drawn on a pixel grid; no image assets are needed.
  function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function cloud(x, y, size = 1) {
    ctx.save(); ctx.translate(Math.round(x), y); ctx.scale(size, size);
    rect(0, 12, 77, 13, '#f6f2d9'); rect(12, 4, 49, 15, '#f6f2d9'); rect(24, 0, 22, 8, '#f6f2d9'); rect(10, 25, 62, 3, '#d6e2bf'); ctx.restore();
  }
  function hill(points, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, ground); for (const p of points) ctx.lineTo(...p); ctx.lineTo(W, ground); ctx.fill(); }
  function tree(x, y, s, dark = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    rect(-5, -35, 10, 48, '#859064'); rect(4, -22, 12, 6, '#859064');
    const color = dark ? '#81995e' : '#a3b67a', light = dark ? '#95aa6b' : '#b3c58c';
    rect(-30, -75, 58, 39, color); rect(-20, -91, 38, 18, color); rect(-41, -62, 80, 19, color); rect(-22, -82, 17, 9, light); rect(-32, -62, 10, 14, light); ctx.restore();
  }
  function background(t) {
    rect(0, 0, W, H, '#dfe8c4');
    rect(W - 180, 45, 54, 54, '#f1d690'); rect(W - 172, 37, 38, 70, '#f1d690'); rect(W - 188, 53, 70, 38, '#f1d690');
    cloud((85 + t * 3) % 1080 - 80, 60, 1.15); cloud((340 + t * 2) % 1100 - 50, 34, .7); cloud((640 + t * 2.5) % 1100 - 50, 101, .9); cloud(879, 135, .65);
    hill([[0, 251], [65, 251], [65, 233], [114, 233], [114, 211], [163, 211], [163, 199], [224, 199], [224, 220], [302, 220], [302, 243], [429, 243], [429, 222], [492, 222], [492, 206], [564, 206], [564, 222], [633, 222], [633, 242], [732, 242], [732, 220], [801, 220], [801, 204], [868, 204], [868, 235], [960, 235]], '#c2d39d');
    hill([[0, 282], [98, 282], [98, 267], [170, 267], [170, 255], [264, 255], [264, 277], [346, 277], [346, 286], [512, 286], [512, 266], [588, 266], [588, 252], [669, 252], [669, 262], [756, 262], [756, 282], [892, 282], [892, 270], [960, 270]], '#b3c78c');
    tree(74, 305, 1.28); tree(W - 74, 298, 1.05); tree(W - 31, 315, .72, true); tree(12, 325, .75, true);
    for (let x = 0; x < W; x += 52) { rect(x, 315, 5, 28, '#bbc391'); rect(x - 1, 311, 7, 6, '#bbc391'); }
    rect(0, 320, W, 4, '#c2c99c'); rect(0, 333, W, 4, '#c2c99c');
    rect(0, ground, W, H - ground, '#a5b775'); rect(0, ground, W, 7, '#789557'); rect(0, ground + 7, W, 4, '#c3cd8d');
    for (let i = 0; i < 62; i++) {
      const x = (i * 137 + 20) % W, y = 362 + (i * 23) % 54;
      rect(x, y, 4, 3, i % 3 === 0 ? '#c2cb8c' : '#92a969');
      if (i % 6 === 0) { rect(x, y - 5, 2, 7, '#819b60'); rect(x - 3, y - 6, 7, 3, i % 12 === 0 ? '#f1dfa0' : '#eee8c1'); }
    }
    // A little park sign and a tennis ball, just for our four-legged visitor.
    rect(796, 307, 4, 39, '#9b976b'); rect(766, 295, 61, 23, '#e2d9ac'); rect(770, 299, 53, 15, '#d4ca9a');
    ctx.fillStyle = '#7b8057'; ctx.font = '7px monospace'; ctx.fillText('WOOF PARK', 774, 309);
    rect(121, 339, 8, 7, '#ebd58a'); rect(123, 337, 4, 2, '#eee1a4');
  }
  const sprite = [
    '          BBBB       ',
    '         BTTTTB      ',
    '         BTTTTTB     ',
    '         BDDTETBBB   ',
    '         BDDTTTCCCN  ',
    ' B       BDDTTCCCCN  ',
    ' BTB    BTTTTTCCCBB  ',
    ' BTTBBBBTTTRRRBB     ',
    '  BTTTTTTTTRRRB      ',
    '   BTTTTTTTTTTB      ',
    '   BTTTTTTTTTTB      ',
    '   BTTTTTTTTTB       ',
    '    BTTBBBBTTB       ',
    '    BTTB  BTTB       ',
    '    BCCB  BCCB       ',
    '    BBBB  BBBB       '
  ];
  const palette = { B: '#73513b', T: '#cf9560', D: '#a86b43', C: '#f4ddb0', E: '#293d35', N: '#344034', R: '#e26c47' };
  function drawDog(t) {
    const scale = 3, airborne = dog.y < ground - 2, moving = keys.ArrowLeft || keys.ArrowRight || keys.KeyA || keys.KeyD;
    const bounce = !airborne ? Math.sin(t * (moving ? 17 : 4)) * (moving ? 2 : 1) : 0;
    ctx.globalAlpha = .16; rect(dog.x - 24, ground - 2, 60 - Math.min(25, (ground - dog.y) / 8), 5, '#34472d'); ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(Math.round(dog.x), Math.round(dog.y + bounce)); ctx.scale(dog.facing, 1);
    if (invulnerable > 0 && Math.floor(t * 12) % 2) ctx.globalAlpha = .5;
    if (activeTrick) {
      const progress = Math.min(1, activeTrick.time / activeTrick.duration);
      ctx.translate(0, -24);
      if (activeTrick.id === 'spin') ctx.scale(Math.cos(progress * Math.PI * 2), 1);
      else if (activeTrick.id === 'grab') ctx.scale(1.12, .78);
      else ctx.rotate(progress * Math.PI * 2 * (activeTrick.id === 'backflip' ? -1 : 1));
      ctx.translate(0, 24);
    } else if (airborne) ctx.rotate(Math.max(-.15, Math.min(.15, dog.vy / 2200)));
    sprite.forEach((row, y) => [...row].forEach((pixel, x) => {
      const legOffset = y >= 13 ? (airborne ? (x < 9 ? -3 : 3) : moving ? Math.round(Math.sin(t * 19 + (x < 9 ? 0 : Math.PI)) * 3) : 0) : 0;
      if (palette[pixel]) rect((x - 10) * scale + legOffset, (y - 16) * scale, scale, scale, palette[pixel]);
    }));
    if (!airborne && Math.sin(t * 10) > 0) { rect(-28, -27, 6, 3, '#cf9560'); }
    ctx.restore();
    if (scared > 0) { ctx.fillStyle = '#b65e42'; ctx.font = 'bold 22px monospace'; ctx.fillText('!', dog.x - 4, dog.y - 60); }
  }
  function drawCat(cat, t) {
    if (cat.warning > 0) {
      const x = cat.direction < 0 ? W - 24 : 24;
      rect(x - 10, ground - 46, 20, 22, '#f4d68b');
      ctx.fillStyle = '#7d543e'; ctx.font = 'bold 16px monospace'; ctx.fillText('!', x - 5, ground - 29);
      return;
    }
    ctx.save(); ctx.translate(Math.round(cat.x), ground); ctx.scale(-cat.direction, 1);
    const step = Math.round(Math.sin(t * 24) * 3);
    rect(-17, -24, 30, 16, '#626476'); rect(-23, -37, 18, 19, '#626476');
    rect(-23, -43, 5, 9, '#626476'); rect(-10, -43, 5, 9, '#626476');
    rect(-21, -31, 4, 3, '#f1d987'); rect(-12, -31, 4, 3, '#f1d987');
    rect(-25, -25, 5, 3, '#d3948b'); rect(11, -29, 6, 17, '#626476'); rect(14, -35, 5, 9, '#626476');
    rect(-15 + step, -9, 5, 9, '#505267'); rect(6 - step, -9, 5, 9, '#505267');
    ctx.restore();
  }
  function disc(f, t) {
    ctx.save(); ctx.translate(Math.round(f.x), Math.round(f.y));
    const colors = f.kind === 'gold' ? ['#a77d25', '#e7b543', '#ffe28b'] : f.kind === 'clock' ? ['#427f8c', '#70bbc3', '#c6f3e8'] : ['#b65535', '#ed8050', '#f3b06d'];
    if (f.kind === 'gold' || f.kind === 'clock') {
      ctx.globalAlpha = .22 + Math.sin(t * 5) * .08; rect(-25, -11, 50, 22, colors[2]); ctx.globalAlpha = 1;
      ctx.fillStyle = colors[0]; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText(f.kind === 'gold' ? '30' : '+3s', 0, -16);
    }
    rect(-19, -2, 38, 7, colors[0]); rect(-16, -5, 32, 7, colors[1]); rect(-10, -7, 20, 3, colors[2]); rect(-8, -3, 16, 2, '#ffcf86');
    rect(Math.sin(t * 12) * 9 - 3, -4, 5, 2, '#ffe7a4'); ctx.restore();
  }
  function update(dt) {
    if (state !== 'playing') return;
    elapsed += dt; remaining = Math.max(0, 60 + timeBonus - elapsed);
    stage = Math.min(5, 1 + Math.floor(elapsed / 15));
    const pace = difficulty();
    slow = Math.max(0, slow - dt); invulnerable = Math.max(0, invulnerable - dt);
    scared = Math.max(0, scared - dt); updateTricks(dt);
    const direction = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    dog.x = Math.max(35, Math.min(W - 40, dog.x + direction * (scared > 0 ? 90 : slow > 0 ? 150 : 300) * dt)); if (direction) dog.facing = direction;
    dog.vy += 1100 * dt; dog.y += dog.vy * dt;
    const justLanded = dog.y >= ground && dog.jumps > 0;
    if (dog.y >= ground) { dog.y = ground; dog.vy = 0; dog.jumps = 0; }
    spawn -= dt;
    if (spawn <= 0) {
      const roll = Math.random(), y = ground - 45 - Math.random() * 150;
      const reverse = elapsed > 30 && Math.random() < .25;
      frisbees.push({ x: reverse ? -25 : W + 25, direction: reverse ? -1 : 1, y, baseY: y, kind: roll < .14 ? 'gold' : roll < .24 && timeBonus < 12 ? 'clock' : 'normal', speed: (pace.speed + Math.random() * 25) * Math.min(1, W / 700 + .25), phase: Math.random() * 6 });
      spawn = pace.interval + Math.random() * .25;
    }
    obstacleSpawn -= dt;
    if (obstacleSpawn <= 0) { obstacles.push({ x: W + 40, hit: false }); obstacleSpawn = pace.mudInterval + Math.random(); }
    obstacles = obstacles.filter(o => {
      o.x -= pace.mudSpeed * dt;
      if (!o.hit && invulnerable <= 0 && Math.abs(dog.x - o.x) < 37 && dog.y > ground - 12) {
        o.hit = true; streak = 0; slow = 1.2; invulnerable = 1.8;
        bail('ATERRIZAJE EN BARRO');
        $('combo').textContent = ''; popups.push({ x: dog.x - 40, y: dog.y - 65, life: 1.2, text: '¡CHOF! SALTA ↑' }); tone(130, .16, 'sawtooth');
        for (let i = 0; i < 8; i++) particles.push({ x: dog.x, y: ground - 3, vx: (Math.random() - .5) * 170, vy: -Math.random() * 100, life: .5, color: '#977255' });
      }
      return o.x > -60;
    });
    catSpawn -= dt;
    if (catSpawn <= 0) {
      const direction = Math.random() < .5 ? -1 : 1;
      cats.push({ x: direction < 0 ? W + 32 : -32, direction, warning: 1.4, hit: false });
      catSpawn = pace.catInterval + Math.random(); tone(310, .12, 'triangle');
    }
    cats = cats.filter(cat => {
      if (cat.warning > 0) { cat.warning = Math.max(0, cat.warning - dt); return true; }
      cat.x += cat.direction * pace.catSpeed * dt;
      if (!cat.hit && invulnerable <= 0 && Math.abs(cat.x - dog.x) < 48 && dog.y > ground - 65) {
        cat.hit = true; scared = .85; invulnerable = 1.8; streak = 0;
        bail('¡SUSTO FELINO!'); $('combo').textContent = '';
        dog.x = Math.max(35, Math.min(W - 40, dog.x + cat.direction * 25));
        dog.vy = -270; dog.jumps = 1; air ||= newAir(); air.failed = true;
        tone(190, .16, 'sawtooth', .02);
      }
      return cat.x > -70 && cat.x < W + 70;
    });
    if (justLanded && scared <= 0) land();
    frisbees = frisbees.filter(f => {
      f.x -= f.speed * (f.direction || 1) * dt;
      if (f.baseY !== undefined) f.y = f.baseY + Math.sin(elapsed * 2.4 + f.phase) * pace.wave;
      if (Math.abs(f.x - (dog.x + 5 * dog.facing)) < 42 && Math.abs(f.y - (dog.y - 26)) < 31) {
        streak++; caught++; maxStreak = Math.max(maxStreak, streak);
        if (air && !air.failed && dog.jumps > 0) air.catches++;
        const points = (f.kind === 'gold' ? 30 : 10) * multiplier(); score += points;
        const extra = f.kind === 'clock' ? Math.min(3, 12 - timeBonus) : 0; timeBonus += extra; remaining += extra;
        tone(780 + Math.min(streak, 6) * 55, .1, 'triangle', .07);
        popups.push({ x: f.x, y: f.y - 10, life: .9, text: `+${points}${extra ? ' / +3s' : ''}` });
        for (let i = 0; i < 12; i++) particles.push({ x: f.x, y: f.y, vx: (Math.random() - .5) * 200, vy: -Math.random() * 170, life: .6, color: ['#f7e4a1', '#ed8050', '#fff8d7'][i % 3] });
        $('combo').textContent = streak >= 3 ? `¡${streak} SEGUIDOS! ×${multiplier()} ✦` : '';
        return false;
      }
      if ((f.direction === -1 && f.x > W + 25) || (f.direction !== -1 && f.x < -25)) { streak = 0; $('combo').textContent = ''; return false; }
      return true;
    });
    particles = particles.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 360 * dt; p.life -= dt; return p.life > 0; });
    popups = popups.filter(p => { p.y -= 45 * dt; p.life -= dt; return p.life > 0; });
    updateHud();
    if (remaining <= 0) finish();
  }
  function render(now) {
    const dt = Math.min((now - last) / 1000 || 0, .04); last = now;
    if (state !== 'paused') sceneTime += dt;
    if (state === 'playing') update(dt);
    background(sceneTime);
    if (state === 'ready') { disc({ x: W * .69 + Math.sin(sceneTime) * 12, y: 298 + Math.cos(sceneTime * 1.4) * 8 }, sceneTime); }
    obstacles.forEach(o => { rect(o.x - 33, ground - 3, 66, 6, '#786545'); rect(o.x - 25, ground - 6, 50, 7, '#9e7c53'); rect(o.x - 14, ground - 4, 20, 3, '#bc9c6c'); rect(o.x + 14, ground - 2, 8, 2, '#bc9c6c'); });
    cats.forEach(cat => drawCat(cat, sceneTime));
    frisbees.forEach(f => disc(f, sceneTime)); drawDog(sceneTime);
    particles.forEach(p => { ctx.globalAlpha = Math.min(1, p.life * 3); rect(p.x, p.y, 4, 4, p.color); }); ctx.globalAlpha = 1;
    popups.forEach(p => { ctx.globalAlpha = Math.min(1, p.life * 3); ctx.fillStyle = '#765338'; ctx.font = 'bold 14px monospace'; ctx.fillText(p.text || '+10', Math.round(p.x), Math.round(p.y)); }); ctx.globalAlpha = 1;
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
