const { randomBytes } = require('node:crypto');
const WIDTH = 2400, HEIGHT = 1600, START_MASS = 18, MAX_PLAYERS = 24;
const TRICKS = { spin: { name: '360', points: 60, duration: .35 }, flip: { name: 'Voltereta', points: 80, duration: .4 }, backflip: { name: 'Backflip', points: 90, duration: .4 }, grab: { name: 'Agarre', points: 40, duration: .25 } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const radius = p => 17 + Math.sqrt(p.mass) * 2.9;
const color = v => typeof v === 'string' && /^#[\da-f]{6}$/i.test(v);
function cleanSkin(skin) { return Array.isArray(skin) && skin.length === 320 ? skin.map(c => c === null || color(c) ? c : null) : null; }
function cleanName(name) { return String(name || 'Patitas').replace(/[<>\x00-\x1f]/g, '').trim().slice(0, 16) || 'Patitas'; }
class Arena {
  constructor(code, random = Math.random) {
    this.code = code; this.random = random; this.players = new Map(); this.time = 0; this.lastActive = Date.now(); this.discId = 0;
    this.bowls = [ [400,400], [1200,400], [2000,400], [400,1200], [1200,1200], [2000,1200] ].map(([x,y],id)=>({id,x,y}));
    this.puddles = []; this.puddleId = 0;
    this.discs = Array.from({ length: 160 }, () => this.disc());
    this.cats = Array.from({ length: 4 }, (_, id) => ({ id, x: 300 + id * 550, y: 300 + id % 2 * 800, phase: id * 2, warning: 0 }));
  }
  addBots() {
    if ([...this.players.values()].some(p => p.bot)) return;
    const names = ['Chispa', 'Toby', 'Luna', 'Pecas', 'Roco', 'Nube'];
    const colors = ['#df8953', '#8c705c', '#b4a0cc', '#e1c78b', '#6b9eb7', '#e6ddd0'];
    names.forEach((name, i) => { const p = this.join({ name, color: colors[i], breed: ['mestizo','corgi','dalmata','husky','salchicha','bordercollie'][i%6] }); p.bot = true; p.brain = { next: 0, target: null, thirsty: false, style: i }; });
  }
  think(p) {
    const ai = p.brain; if (this.time < ai.next) return; ai.next = this.time + .15;
    const actions = []; let target = null, flee = false;
    const distance = q => Math.hypot(q.x-p.x, q.y-p.y);
    const threat = [...this.players.values()].filter(q => q !== p && q.mass >= p.mass*1.3 && q.shield <= 0 && p.shield <= 0 && distance(q)<240).sort((a,b)=>distance(a)-distance(b))[0];
    const cat = this.cats.find(c => c.warning > 0 && distance(c)<155);
    if (threat || cat) {
      const danger = threat || cat; const dx=p.x-danger.x, dy=p.y-danger.y;
      target={x:p.x+(dx || 60), y:p.y+(dy || 40)}; flee=true;
      if (!p.jumps) actions.push('jump');
    } else {
      if (p.water < 30) ai.thirsty = true;
      if (p.water >= 95) ai.thirsty = false;
      if (ai.thirsty) {
        target = this.bowls.slice().sort((a,b)=>distance(a)-distance(b))[0];
        if (target && distance(target)<55) target=null;
      } else {
        const prey = [...this.players.values()].find(q => q!==p && q.peeing>0 && q.shield<=0 && p.shield<=0 && p.mass>=q.mass*1.3 && q.z<30 && distance(q)<160);
        if (prey) target=prey;
        else {
          let disc = this.discs.find(f=>f.id===ai.target);
          if (!disc || distance(disc)>600) {
            disc=this.discs.slice().sort((a,b)=>(distance(a)/(a.value===8?1.3:1))-(distance(b)/(b.value===8?1.3:1)))[0];
            ai.target=disc?.id;
          }
          if (disc) {
            const lead=Math.min(.55,distance(disc)/220);
            target={x:clamp(disc.x+Math.cos(disc.angle)*disc.speed*lead,40,WIDTH-40),y:clamp(disc.y+Math.sin(disc.angle)*disc.speed*lead,40,HEIGHT-40)};
            if (!p.jumps && distance(disc)<radius(p)+65) actions.push('jump');
            else if (p.jumps===1 && disc.high && p.z>55 && p.vz<230) actions.push('jump');
            if (p.jumps && p.z>70 && p.vz>170 && !p.trick && p.air && !p.air.ids.length && ai.style%2===0) actions.push('grab');
          }
        }
      }
    }
    let dx=target?target.x-p.x:0, dy=target?target.y-p.y:0;
    if (flee) { if(p.x<90)dx=Math.abs(dx)+80; if(p.x>WIDTH-90)dx=-Math.abs(dx)-80; if(p.y<90)dy=Math.abs(dy)+80; if(p.y>HEIGHT-90)dy=-Math.abs(dy)-80; }
    const length=Math.hypot(dx,dy);
    this.input(p,{seq:p.lastSeq+1,x:length>8?dx/length:0,y:length>8?dy/length:0,boost:flee&&p.water>40,actions});
  }
  disc() {
    const path = ['straight', 'diagonal', 'curve', 'wave'][Math.floor(this.random() * 4)];
    const angle = path === 'straight' ? Math.floor(this.random() * 4) * Math.PI / 2 : Math.PI / 4 + Math.floor(this.random() * 4) * Math.PI / 2;
    const high = this.random() < .3;
    return { id: ++this.discId, x: 55 + this.random() * (WIDTH - 110), y: 55 + this.random() * (HEIGHT - 110), value: this.random() < .12 ? 8 : 3,
      path, angle, speed: 65 + this.random() * 65, turn: (this.random() < .5 ? -1 : 1) * (.35 + this.random() * .4), phase: this.random() * Math.PI * 2,
      age: 0, high, height: high ? 120 : 70, baseHeight: high ? 120 : 70 };
  }
  fly(f, dt) {
    f.age += dt;
    if (f.path === 'curve') f.angle += f.turn * dt;
    if (f.path === 'wave') f.angle += Math.cos(f.age * 1.6 + f.phase) * 1.15 * dt;
    f.x += Math.cos(f.angle) * f.speed * dt; f.y += Math.sin(f.angle) * f.speed * dt;
    if (f.x < 35 || f.x > WIDTH - 35) { f.x = clamp(f.x, 35, WIDTH - 35); f.angle = Math.PI - f.angle; }
    if (f.y < 35 || f.y > HEIGHT - 35) { f.y = clamp(f.y, 35, HEIGHT - 35); f.angle = -f.angle; }
    f.height = f.baseHeight + Math.sin(f.age * 1.8 + f.phase) * 6;
  }
  spawn(p) {
    for (let tries = 0; tries < 30; tries++) {
      p.x = 100 + this.random() * (WIDTH - 200); p.y = 100 + this.random() * (HEIGHT - 200);
      if (![...this.players.values()].some(other => other !== p && Math.hypot(other.x - p.x, other.y - p.y) < radius(other) + 160)) break;
    }
    p.peeIn = 45; p.water = 100; p.peeing = 0; p.peeCooldown = 0; p.drinking = false; p.z = 0; p.vz = 0; p.jumps = 0; p.shield = 5; p.mass = START_MASS; p.air = null; p.trick = null; p.scared = 0;
  }
  join(profile = {}) {
    if ([...this.players.values()].filter(p => !p.bot).length >= MAX_PLAYERS) throw new Error('La sala está llena (24 perros). Prueba otra sala.');
    const id = randomBytes(8).toString('hex'), token = randomBytes(24).toString('hex');
    const p = { id, token, name: cleanName(profile.name), breed: ['mestizo','corgi','dalmata','husky','salchicha','bordercollie'].includes(profile.breed) ? profile.breed : 'mestizo', color: color(profile.color) ? profile.color : '#cf9560', skin: cleanSkin(profile.skin), mass: START_MASS, score: 0, caught: 0, tags: 0, bestCombo: 0, facing: 1, input: { x: 0, y: 0, boost: false }, lastInput: this.time, lastSeen: Date.now(), lastSeq: -1, notice: '¡Bienvenido al parque!', noticeUntil: this.time + 4, connected: true };
    this.spawn(p); this.players.set(id, p); this.lastActive = Date.now(); return p;
  }
  pee(p) {
    p.water = Math.max(0, p.water - 8); p.peeing = 3; p.peeCooldown = 20; p.peeIn = 45; p.shield = 0;
    this.puddles.push({ id: ++this.puddleId, x: p.x - p.facing * 20, y: p.y + 6, expires: this.time + 12 });
    this.notice(p, '¡Meando! Estás vulnerable durante 3 s');
  }
  notice(p, text) { p.notice = text; p.noticeUntil = this.time + 2.5; }
  input(p, data) {
    if (!Number.isSafeInteger(data.seq) || data.seq <= p.lastSeq) return;
    p.lastSeq = data.seq; p.lastSeen = Date.now(); p.lastInput = this.time;
    let x = Number.isFinite(data.x) ? clamp(data.x, -1, 1) : 0, y = Number.isFinite(data.y) ? clamp(data.y, -1, 1) : 0;
    const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
    p.input = { x, y, boost: data.boost === true };
    for (const action of (Array.isArray(data.actions) ? data.actions.slice(0, 4) : [])) {
      if (action === 'pee') {
        if (p.peeCooldown > 0 || p.peeing > 0) continue;
        if (p.jumps || p.scared > 0) { this.notice(p, 'Espera a estar en el suelo'); continue; }
        this.pee(p); continue;
      }
      if (p.peeing > 0) continue;
      if (action === 'jump' && p.peeIn > 0 && p.jumps < 2 && p.scared <= 0) {
        if (!p.jumps) p.air = { ids: [], points: 0, catches: 0, failed: false, special: false };
        p.vz = p.jumps ? 420 : 470; p.jumps++;
      } else if (Object.hasOwn(TRICKS, action) && p.jumps > 0 && p.scared <= 0 && !p.trick && p.air && !p.air.failed && p.air.ids.length < 5) p.trick = { id: action, t: 0 };
    }
  }
  bail(p, reason) { if (p.air) p.air.failed = true; p.trick = null; this.notice(p, reason); }
  airValue(p) { return p.air ? (p.air.points + p.air.catches * 25) * Math.min(5, new Set(p.air.ids).size + (p.air.special ? 1 : 0)) : 0; }
  step(dt = .05) {
    dt = clamp(dt, 0, .1); this.time += dt;
    this.puddles = this.puddles.filter(f => f.expires > this.time);
    for (const f of this.discs) this.fly(f, dt);
    for (const p of this.players.values()) {
      if (p.bot) this.think(p);
      if (this.time - p.lastInput > .45) p.input = { x: 0, y: 0, boost: false };
      p.shield = Math.max(0, p.shield - dt); p.scared = Math.max(0, p.scared - dt);
      p.peeing = Math.max(0, p.peeing - dt); p.peeCooldown = Math.max(0, p.peeCooldown - dt);
      if (!p.peeing) p.peeIn = Math.max(0, p.peeIn - dt);
      if (p.peeIn <= 0 && !p.jumps && !p.peeing) this.pee(p);
      const oldX = p.x, oldY = p.y;
      const boost = p.peeing <= 0 && p.input.boost && p.mass > START_MASS + 3 && p.scared <= 0;
      const speed = (210 / (1 + (radius(p) - 29) / 100)) * (boost ? 1.65 : 1) * (p.scared > 0 ? .4 : 1) * (.45 + .55 * p.water / 100) * (p.peeing > 0 ? 0 : 1);
      if (boost) p.mass = Math.max(START_MASS, p.mass - dt * 2);
      if (p.mass > 120) p.mass = Math.max(120, p.mass - p.mass * .002 * dt);
      const r = radius(p); p.x = clamp(p.x + p.input.x * speed * dt, r, WIDTH - r); p.y = clamp(p.y + p.input.y * speed * dt, r, HEIGHT - r);
      const distance = Math.hypot(p.x - oldX, p.y - oldY);
      p.water = Math.max(0, p.water - distance * .012 * (boost ? 1.4 : 1));
      p.drinking = !p.jumps && p.peeing <= 0 && p.scared <= 0 && Math.hypot(p.input.x, p.input.y) < .1 && this.bowls.some(b => Math.hypot(p.x - b.x, p.y - b.y) < 72);
      if (p.drinking) p.water = Math.min(100, p.water + dt * 24);
      if (p.input.x && !p.peeing) p.facing = Math.sign(p.input.x);
      if (p.trick) {
        p.trick.t += dt; const def = TRICKS[p.trick.id];
        if (p.trick.t >= def.duration) {
          const id = p.trick.id; p.air.points += Math.max(10, Math.round(def.points / (p.air.ids.filter(x => x === id).length + 1))); p.air.ids.push(id);
          if (!p.air.special && p.air.ids.slice(-3).join(',') === 'spin,grab,backflip') { p.air.special = true; p.air.points += 200; }
          p.trick = null;
        }
      }
      if (p.jumps) {
        p.vz -= 1100 * dt; p.z += p.vz * dt;
        if (p.z <= 0) {
          p.z = 0; p.vz = 0; p.jumps = 0;
          if (p.trick) this.bail(p, 'Giro incompleto: combo perdido');
          if (p.air && !p.air.failed && p.air.ids.length) { const points = this.airValue(p); p.score += points; p.bestCombo = Math.max(p.bestCombo, points); this.notice(p, `¡Aterrizaje limpio! +${points}`); }
          p.air = null; p.trick = null;
        }
      }
      for (let i = 0; i < this.discs.length; i++) {
        const f = this.discs[i];
        if (p.jumps > 0 && p.z >= 35 && Math.abs(p.z - f.height) < 24 && Math.hypot(p.x - f.x, p.y - f.y) < r + 9) {
          p.mass = Math.min(2500, p.mass + f.value); p.score += f.value * 5; p.caught++;
          if (p.air && !p.air.failed) p.air.catches++;
          this.discs[i] = this.disc();
        }
      }
    }
    for (const cat of this.cats) {
      cat.x = clamp(cat.x + Math.cos(this.time * .23 + cat.phase) * 75 * dt, 70, WIDTH - 70);
      cat.y = clamp(cat.y + Math.sin(this.time * .31 + cat.phase) * 60 * dt, 70, HEIGHT - 70);
      const phase = (this.time + cat.phase) % 8; cat.warning = phase > 5 ? 8 - phase : 0;
      if (phase < 7.4) continue;
      for (const p of this.players.values()) if (p.shield <= 0 && p.scared <= 0 && !p.peeing && p.z < 60 && Math.hypot(p.x - cat.x, p.y - cat.y) < radius(p) + 80) {
        this.bail(p, '¡MIAU! Te asustaste: salta el círculo'); p.scared = 1.2; p.shield = 2; p.vz = 270; p.jumps = Math.max(1, p.jumps);
      }
    }
    const players = [...this.players.values()];
    for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
      const a = players[i], b = players[j], big = a.mass >= b.mass ? a : b, small = big === a ? b : a;
      if (!small.peeing || big.peeing || big.shield > 0 || small.shield > 0 || big.z > 30 || small.z > 30 || big.mass < small.mass * 1.3) continue;
      if (Math.hypot(big.x - small.x, big.y - small.y) < radius(big) - radius(small) * .15) {
        const loot = Math.max(6, Math.floor(small.mass * .35)); big.mass = Math.min(2500, big.mass + loot); big.score += 100; big.tags++;
        this.notice(big, `¡Pillaste a ${small.name}! +${loot} masa`); this.spawn(small); this.notice(small, `${big.name} te pilló. Reapareces con protección.`);
      }
    }
  }
  snapshot() {
    return { room: this.code, width: WIDTH, height: HEIGHT, time: this.time, discs: this.discs, cats: this.cats, bowls: this.bowls, puddles: this.puddles,
      players: [...this.players.values()].map(p => ({ id: p.id, bot: p.bot === true, breed: p.breed, peeIn: p.peeIn, name: p.name, color: p.color, skin: p.skin, x: p.x, y: p.y, z: p.z, water: p.water, drinking: p.drinking, peeing: p.peeing, peeCooldown: p.peeCooldown, mass: p.mass, score: p.score, caught: p.caught, tags: p.tags, bestCombo: p.bestCombo, facing: p.facing, shield: p.shield, scared: p.scared, trick: p.trick, airNames: p.air && !p.air.failed ? p.air.ids.map(id => TRICKS[id].name) : [], pending: p.air && !p.air.failed ? this.airValue(p) : 0, notice: p.noticeUntil > this.time ? p.notice : '', connected: p.connected })) };
  }
}
module.exports = { Arena, radius, cleanSkin, cleanName, WIDTH, HEIGHT, MAX_PLAYERS };
