const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const nodes = new Map(), saved = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, { textContent: '', innerHTML: '', style: {}, clientWidth: 960, clientHeight: 420, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, setAttribute() {}, focus() {}, getContext: () => new Proxy({}, { get: (target, key) => target[key] || (() => {}), set: (target, key, value) => { target[key] = value; return true; } }) });
  return nodes.get(id);
}
const sandbox = { document: { getElementById: node, querySelector: node, addEventListener() {} }, window: { addEventListener() {} }, localStorage: { getItem: k => saved.get(k), setItem: (k,v) => saved.set(k,v) }, requestAnimationFrame() {}, Math, HTMLButtonElement: class {}, HTMLAnchorElement: class {} };
const source = fs.readFileSync('game.js', 'utf8').replace('  requestAnimationFrame(render);\n})();', '  globalThis.test = { start, jump, pause, update, finish, resize, dog, trick, directionalTrick, difficulty, render, get air() { return air; }, get bestTrick() { return bestTrick; }, get activeTrick() { return activeTrick; }, get scared() { return scared; }, get cats() { return cats; }, setCats(value) { cats = value; }, setKeys(value) { keys = value; }, get state() { return state; }, get score() { return score; }, get remaining() { return remaining; }, setDiscs(value) { frisbees = value; }, setObstacles(value) { obstacles = value; }, get streak() { return streak; }, get timeBonus() { return timeBonus; } };\n})();');
vm.runInNewContext(source, sandbox);
const game = sandbox.test;
game.start(); assert.equal(game.state, 'playing');
game.jump(); assert.equal(game.dog.jumps, 1); assert.ok(game.dog.vy < 0);
game.jump(); assert.equal(game.dog.jumps, 2);
game.jump(); assert.equal(game.dog.jumps, 2, 'Cannot jump a third time');
for (let i = 0; i < 80; i++) game.update(.02);
assert.equal(game.dog.jumps, 0); assert.equal(game.dog.y, 346);
game.setDiscs([{ x: game.dog.x + 5, y: game.dog.y - 26, speed: 0 }]);
game.update(.01); assert.equal(game.score, 10, 'Catching a frisbee awards ten points');
game.update(.01); assert.equal(game.score, 10, 'A frisbee can only be caught once');
game.pause(); assert.equal(game.state, 'paused');
const pausedTime = game.remaining; game.update(1); assert.equal(game.remaining, pausedTime, 'Pause freezes the timer');
game.pause(); assert.equal(game.state, 'playing');
for (let i = 0; i < 4000 && game.state === 'playing'; i++) game.update(.02);
assert.equal(game.state, 'over'); assert.equal(game.remaining, 0); assert.equal(saved.get('frisbee-club-best'), game.score); assert.ok(game.score >= 10);
game.start(); assert.equal(game.score, 0); assert.equal(game.remaining, 60);
function catchDisc(kind) { game.setDiscs([{ x: game.dog.x + 5, y: game.dog.y - 26, speed: 0, kind }]); game.update(.01); }
catchDisc('normal'); catchDisc('normal'); catchDisc('gold');
assert.equal(game.score, 80, 'Third catch activates x2 and multiplies the golden frisbee');
for (let i = 0; i < 5; i++) catchDisc('clock');
assert.equal(game.timeBonus, 12, 'Bonus time is capped at twelve seconds');
assert.equal(game.streak, 8);
game.setObstacles([{ x: game.dog.x, hit: false }]); game.update(.01);
assert.equal(game.streak, 0, 'Mud breaks the combo');
game.start(); game.jump(); game.update(.1); catchDisc('normal');
game.setObstacles([{ x: game.dog.x, hit: false }]); game.update(.01);
assert.equal(game.streak, 1, 'Jumping over mud preserves the combo');
node('screen').clientWidth = 360; node('screen').clientHeight = 300; game.dog.x = 900; game.resize();
assert.ok(game.dog.x <= 464, 'Dog stays within the mobile play area');
node('screen').clientWidth = 960; node('screen').clientHeight = 420; game.resize();
function advance(seconds) { for (let t = 0; t < seconds - .0001; t += .01) game.update(.01); }
function cleanStart() { game.start(); game.setDiscs([]); game.setObstacles([]); game.setCats([]); }
cleanStart(); assert.equal(game.trick('spin'), false, 'Tricks require being airborne');
game.jump(); assert.equal(game.trick('spin'), true); assert.equal(game.trick('grab'), false, 'One animation at a time');
advance(.34); assert.equal(game.score, 0, 'Trick points stay pending before landing');
assert.equal(game.air.ids.length, 1);
game.pause(); const airBeforePause = game.air.points; advance(.5); assert.equal(game.air.points, airBeforePause); game.pause();
advance(.65); assert.equal(game.score, 60, 'Clean landing banks a completed spin'); assert.equal(game.bestTrick, 60);
cleanStart(); game.jump(); advance(.7); game.trick('backflip'); advance(.22);
assert.equal(game.score, 0, 'Landing before rotation ends loses the pending combo');
cleanStart(); game.jump(); game.setKeys({ ArrowRight: true }); game.directionalTrick(); advance(.33); game.setKeys({});
game.trick('grab'); advance(.25); game.jump(); game.setKeys({ ArrowLeft: true }); game.directionalTrick(); advance(.41); game.setKeys({});
assert.equal(game.air.special, true, 'Spin, grab, backflip unlocks the special');
assert.equal(game.score, 0); advance(.6);
assert.equal(game.score, 1560, 'Special banks (60+40+90+200) times four on landing');
cleanStart(); game.jump(); game.trick('spin'); advance(.33); game.trick('spin'); advance(.33);
assert.equal(game.air.points, 90, 'Repeating a trick gives diminishing points');
advance(.3); assert.equal(game.score, 90, 'Repeated tricks do not increase the variety multiplier');
cleanStart(); game.jump(); game.trick('grab'); advance(.25); catchDisc('normal'); advance(.7);
assert.equal(game.score, 75, 'An airborne catch adds 25 to the trick base plus its own ten points');
cleanStart(); game.jump(); game.trick('spin'); advance(.75);
game.setObstacles([{ x: game.dog.x + 16, hit: false }]); advance(.16);
assert.equal(game.score, 0, 'Landing on mud loses completed tricks before banking');
cleanStart(); game.jump(); game.trick('spin'); advance(.7);
game.setCats([{ x: game.dog.x, direction: 1, warning: .2, hit: false }]); advance(.1);
assert.equal(game.scared, 0, 'Cat cannot scare during its warning');
game.setCats([{ x: game.dog.x, direction: 1, warning: 0, hit: false }]); advance(.01);
assert.ok(game.scared > 0); assert.equal(game.air.failed, true); assert.equal(game.trick('grab'), false);
assert.equal(game.score, 0, 'A fright cancels pending points');
cleanStart(); game.jump(); advance(.25);
game.setCats([{ x: game.dog.x, direction: 1, warning: 0, hit: false }]); advance(.01);
assert.equal(game.scared, 0, 'Jumping high enough avoids the cat');
game.render(20);
cleanStart(); game.jump(); game.trick('flip'); advance(.15); game.render(40);
game.finish(); assert.equal(game.score, 0, 'Unlanded tricks cannot score at timeout');
assert.equal(game.activeTrick, null);
for (const seconds of [0, 15, 30, 45, 60]) {
  const early = game.difficulty(seconds), later = game.difficulty(seconds + 5);
  assert.ok(later.speed > early.speed && later.catSpeed > early.catSpeed && later.wave > early.wave);
  assert.ok(later.interval < early.interval && later.mudInterval < early.mudInterval && later.catInterval < early.catInterval);
}
cleanStart(); assert.equal(game.air, null); assert.equal(game.cats.length, 0); assert.equal(game.scared, 0); assert.equal(game.bestTrick, 0);
console.log('Passed: core game, continuous difficulty, directional tricks, landing/bail, special combo, repetition penalty, aerial catches, cat warning/evasion/fright, pause, rendering, timeout and reset.');


