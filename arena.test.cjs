const assert = require('node:assert/strict');
const { Arena, radius, cleanSkin } = require('./arena-core.cjs');
let seed = 81; const rng = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
function setup() { const room = new Arena('test', rng); room.discs = []; room.cats = []; return room; }
function steps(room, seconds) { for (let i = 0; i < Math.round(seconds * 20); i++) room.step(.05); }
let room = setup(), p = room.join({ name: '<Pixel>', skin: Array(320).fill('#ff00ff') });
assert.equal(p.name, 'Pixel'); assert.equal(p.skin.length, 320); assert.equal(cleanSkin(['#ffffff']), null);
const original = radius(p); room.discs = [{ ...room.disc(), x: p.x, y: p.y, speed: 0, baseHeight: 70, value: 3 }]; room.step(); assert.equal(p.caught, 0, 'Grounded dogs cannot catch'); room.input(p, { seq: 0, actions: ['jump'] }); steps(room, .2); assert.equal(p.mass, 21); assert.ok(radius(p) > original); assert.equal(p.caught, 1);
room.discs = []; const startX = p.x; room.input(p, { seq: 1, x: 1, y: 0, mass: 999999 }); steps(room, .3); assert.ok(p.x > startX); assert.equal(p.mass, 21, 'Client cannot forge mass');
room.input(p, { seq: 1, x: -1, y: 0 }); assert.equal(p.input.x, 1, 'Replay sequence ignored');
steps(room, 1); assert.equal(p.input.x, 0, 'Stale controls stop automatically');
p.mass = 50; room.input(p, { seq: 2, x: 1, y: 1, boost: true }); assert.ok(Math.hypot(p.input.x, p.input.y) <= 1.001); steps(room, .2); assert.ok(p.mass < 50, 'Turbo consumes mass');
room = setup(); const big = room.join(), small = room.join(); big.x = small.x = 500; big.y = small.y = 500; big.mass = 100; small.mass = 30; big.shield = small.shield = 0;
room.step(); assert.equal(big.tags, 0, 'No attack outside pee vulnerability'); room.pee(small); room.step(); assert.equal(big.tags, 1); assert.equal(small.mass, 18); assert.ok(small.shield > 0); assert.ok(big.mass > 100);
big.x = small.x; big.y = small.y; room.step(); assert.equal(big.tags, 1, 'Spawn shield prevents repeated tags');
small.shield = 0; small.z = 100; small.jumps = 1; small.vz = 0; big.x = small.x; big.y = small.y; room.step(); assert.equal(big.tags, 1, 'Jump avoids getting tagged');
room = setup(); p = room.join(); room.input(p, { seq: 1, actions: ['jump', 'spin'] }); steps(room, .4); assert.equal(p.score, 0); assert.equal(p.air.points, 60); steps(room, .5); assert.equal(p.score, 60, 'Tricks bank on landing');
room.input(p, { seq: 2, actions: ['jump', '__proto__'] }); assert.equal(p.trick, null); steps(room, .65); room.input(p, { seq: 3, actions: ['backflip'] }); steps(room, .3); assert.equal(p.score, 60, 'Incomplete trick does not pay');
room = setup(); p = room.join(); p.shield = 0; room.time = 7.5; room.cats = [{ x: p.x, y: p.y, phase: 0 }]; room.step(); assert.ok(p.scared > 0, 'Cat causes fright');
const snapshot = room.snapshot(); assert.equal(snapshot.players[0].token, undefined); assert.ok(!JSON.stringify(snapshot).includes(p.token), 'No bearer tokens in snapshots');
assert.equal(new Arena('other').players.size, 0, 'Rooms do not share players');

room = new Arena('flight', rng); room.cats = [];
assert.equal(new Set(room.discs.map(f => f.path)).size, 4);
for (const path of ['straight', 'diagonal', 'curve', 'wave']) {
  const f = { ...room.disc(), path, x: 900, y: 800, angle: path === 'straight' ? 0 : Math.PI / 4 };
  const angle = f.angle; room.discs = [f]; steps(room, 1);
  assert.ok(Math.hypot(f.x - 900, f.y - 800) > 40);
  if (path === 'straight') assert.equal(f.y, 800);
  if (path === 'diagonal') { assert.ok(f.x > 900 && f.y > 800); assert.equal(f.angle, angle); }
  if (path === 'curve') assert.notEqual(f.angle, angle);
  steps(room, 180);
  assert.ok(f.x >= 35 && f.x <= 2365 && f.y >= 35 && f.y <= 1565);
  assert.ok(f.height >= 64 && f.height <= 126);
}
room = setup(); p = room.join(); p.mass = 2500;
room.discs = [{ ...room.disc(), x: p.x, y: p.y, speed: 0, baseHeight: 70 }];
steps(room, 1); assert.equal(p.caught, 0, 'Even giant dogs must jump');
room = setup(); p = room.join();
room.discs = [{ ...room.disc(), x: p.x, y: p.y, speed: 0, baseHeight: 120 }];
room.input(p, { seq: 0, actions: ['jump'] }); steps(room, .85);
assert.equal(p.caught, 0, 'High discs require a double jump');
room.input(p, { seq: 1, actions: ['jump'] }); steps(room, .3);
room.input(p, { seq: 2, actions: ['jump'] }); steps(room, .2);
assert.equal(p.caught, 1, 'Double jump reaches high discs');

// Hydration is authoritative, distance-based and recoverable even when empty.
room = setup(); p = room.join(); p.x=800; p.y=800;
steps(room,1); assert.equal(p.water,100,'Idle does not consume water');
room.input(p,{seq:0,x:1,water:999}); const hydratedX=p.x; steps(room,.3);
const hydratedDistance=p.x-hydratedX; assert.ok(p.water<100);
p.water=0; const dryX=p.x; room.input(p,{seq:1,x:1}); steps(room,.3);
assert.ok(p.x>dryX && p.x-dryX < hydratedDistance*.5,'Empty water slows without immobilizing');
p.x=room.bowls[0].x; p.y=room.bowls[0].y;
room.input(p,{seq:2}); steps(room,1); assert.ok(p.drinking); assert.ok(Math.abs(p.water-24)<.01);
steps(room,5); assert.equal(p.water,100,'Refill is capped');
room.input(p,{seq:3,actions:['jump']}); steps(room,.1); assert.equal(p.drinking,false,'Cannot drink in flight');
steps(room,1); room.input(p,{seq:4,actions:['pee','pee','jump']});
assert.equal(p.water,92); assert.equal(room.puddles.length,1); assert.equal(p.jumps,0,'Pee blocks jumps');
const peeX=p.x; room.input(p,{seq:5,x:1}); steps(room,.3); assert.equal(p.x,peeX,'Pee briefly stops movement');
room.input(p,{seq:6,actions:['pee']}); assert.equal(room.puddles.length,1,'Cooldown prevents spam');
assert.equal(room.snapshot().players[0].peeing,p.peeing); assert.equal(room.snapshot().bowls.length,6);
steps(room,13); assert.equal(room.puddles.length,0,'Puddles expire');
steps(room,7); room.input(p,{seq:7,actions:['pee']}); assert.equal(room.puddles.length,1,'Can pee again after cooldown');
room.spawn(p); assert.equal(p.water,100); assert.equal(p.peeing,0);
p.water=7; room.input(p,{seq:8,actions:['pee']}); assert.equal(p.peeing,3,'Pee remains possible with little water'); assert.equal(p.water,0);

room = new Arena('bots', rng); room.addBots(); room.addBots();
assert.equal(room.players.size,6,'Exactly six bots, no duplicates');
const bots=[...room.players.values()]; const startBots=bots.map(p=>({x:p.x,y:p.y}));
steps(room,30);
assert.ok(bots.every((p,i)=>Math.hypot(p.x-startBots[i].x,p.y-startBots[i].y)>20),'All bots move');
assert.ok(bots.reduce((n,p)=>n+p.caught,0)>0,'Bots catch flying discs using jumps');
room=setup(); room.addBots(); const thirsty=[...room.players.values()][0];
thirsty.water=10; thirsty.x=room.bowls[0].x; thirsty.y=room.bowls[0].y;
steps(room,2); assert.ok(thirsty.water>50,'Thirsty bot stops and drinks');
const publicBot=room.snapshot().players[0]; assert.equal(publicBot.bot,true); assert.equal(publicBot.brain,undefined);

room=setup(); p=room.join({breed:'husky'}); p.water=0; p.peeIn=.05; room.step();
assert.equal(p.peeing,3,'Mandatory pee even without water'); assert.equal(p.shield,0);
room.input(p,{seq:0,actions:['jump']}); assert.equal(p.jumps,0,'Cannot jump during vulnerability');
steps(room,3.1); assert.equal(p.peeing,0); assert.ok(p.peeIn>44);
p.peeIn=0; p.jumps=1; p.z=30; p.vz=-100; steps(room,.4); assert.ok(p.peeing>0,'Mandatory pee on landing');
assert.equal(room.snapshot().players[0].breed,'husky'); assert.equal(room.join({breed:'invalid'}).breed,'mestizo');
const vm=require('node:vm'), fs=require('node:fs'); const artContext={window:{}}; vm.runInNewContext(fs.readFileSync('sprite.js','utf8'),artContext);
const art=artContext.window.DogArt; const skins=Object.keys(art.breeds).map(b=>art.make('#cf9560',b));
assert.ok(skins.every(art.valid)); assert.equal(new Set(skins.map(s=>JSON.stringify(s))).size,5,'Distinct breed sprites');

async function integration() {
  const { server, sessions, drop } = require('./server.cjs');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const base = `http://127.0.0.1:${server.address().port}`;
  const streams = [];
  async function post(route, value, token) { return fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(value) }); }
  try {
    const a = await (await post('/api/join', { room: 'friends', name: 'Uno', skin: Array(320).fill('#ffaa00') })).json();
    const b = await (await post('/api/join', { room: 'friends', name: 'Dos' })).json();
    const c = await (await post('/api/join', { room: 'separate', name: 'Tres' })).json();
    async function connect(token) {
      const controller = new AbortController(); streams.push(controller);
      const response = await fetch(base + '/api/events?token=' + token, { signal: controller.signal }); assert.equal(response.status, 200);
      const reader = response.body.getReader(), decoder = new TextDecoder(); let pending = '';
      return async () => {
        while (!pending.includes('\n\n')) { const { value, done } = await reader.read(); if (done) throw new Error('Stream closed'); pending += decoder.decode(value, { stream: true }); }
        const split = pending.indexOf('\n\n'), line = pending.slice(0, split); pending = pending.slice(split + 2); return JSON.parse(line.replace(/^data: /, ''));
      };
    }
    const readA = await connect(a.token), readB = await connect(b.token), readC = await connect(c.token);
    const initialA = await readA(), initialB = await readB(), initialC = await readC();
    assert.equal(initialA.players.length, 9); assert.equal(initialB.players.length, 9); assert.equal(initialC.players.length, 9); assert.equal(a.room, c.room); assert.equal(initialA.players.filter(p=>p.bot).length,6);
    assert.deepEqual(initialB.players.find(p => p.id === a.id).skin, Array(320).fill('#ffaa00'), 'Other clients see pixel art');
    const before = sessions.get(a.token).player.x;
    assert.equal((await post('/api/input', { seq: 1, x: 1, y: 0 }, a.token)).status, 200);
    let latest; for (let i = 0; i < 5; i++) latest = await readB();
    assert.ok(latest.players.find(p => p.id === a.id).x > before, 'Remote client observes movement');
    const oldDisc = initialB.discs[0], movedDisc = latest.discs.find(f => f.id === oldDisc.id);
    assert.ok(movedDisc && Math.hypot(movedDisc.x - oldDisc.x, movedDisc.y - oldDisc.y) > 1, 'Remote clients receive flying discs');
    assert.equal((await post('/api/input', { seq: 1, x: 1 }, 'bad')).status, 401);
    assert.equal((await post('/api/join', { room: '../escape' })).status, 200, 'All room names map to public park');
    assert.equal((await fetch(base + '/server.cjs')).status, 404);
    assert.equal((await fetch(base + '/arena.js')).status, 200);
    assert.equal((await fetch(base + '/solo.html')).status, 200);
    assert.equal((await fetch(base + '/health')).status, 200);
    assert.equal((await fetch(base + '/api/join', { method: 'POST', headers: { Origin: 'https://unrelated.invalid' }, body: '{}' })).status, 403);
    await post('/api/leave', {}, a.token); assert.equal(sessions.has(a.token), false);
    console.log('Passed: growth, authoritative movement, replay protection, boost, tags, shields, jumps, tricks, fright, two real streaming clients, single public park, pixel art replication, auth, static allowlist and disconnect.');
  } finally {
    streams.forEach(s => s.abort()); for (const token of sessions.keys()) drop(token);
    await new Promise(resolve => server.close(resolve));
  }
}
integration().catch(error => { console.error(error); process.exitCode = 1; });
