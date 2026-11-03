const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
// Run the actual game simulation with browser rendering/audio replaced by no-ops.
const element=()=>({style:{},classList:{add(){},remove(){},toggle(){}},querySelector(){return null},querySelectorAll(){return []},addEventListener(){},getContext(){return {}},focus(){}});
const els=new Map(),sandbox={console,Date,Math,JSON,Image:class{},HTMLInputElement:class{},localStorage:{getItem(){return null},setItem(){}},document:{querySelector(s){if(!els.has(s))els.set(s,element());return els.get(s)},querySelectorAll(){return []},addEventListener(){}},window:{addEventListener(){}},requestAnimationFrame(){},setInterval(){},setTimeout(){},clearTimeout(){}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('dist/game.js','utf8'),sandbox);
const run=s=>vm.runInContext(s,sandbox);
assert.match(run('catdogCheck()'),/^PASS/);
run("practice=-1;startGame()");
assert.equal(run('state'),'intro','normal encounter begins with stage introduction');
run('for(let i=0;i<270;i++)step()');
assert.equal(run('state'),'dialogue','stage introduction leads to dialogue');
assert.equal(run('game.phaseFrame'),0,'intro does not consume spell time');
run("chosen='Easy';practice=-1;startGame();state='playing';keys.add('z')");
run("for(let i=0;i<22000&&state==='playing';i++)step()");
assert.equal(run('state'),'result','full encounter must end');
const first=JSON.parse(run('JSON.stringify({score:game.score,frame:game.frame,phase:game.phase,graze:game.graze,result:record.result})'));
run("playback=JSON.parse(JSON.stringify(data.replay));startGame(true);for(let i=0;i<22000&&state==='playing';i++)step()");
const second=JSON.parse(run('JSON.stringify({score:game.score,frame:game.frame,phase:game.phase,graze:game.graze,result:playback.result})'));
assert.deepEqual(second,first,'replay must reproduce score, hits, timing and graze');
for(let phase=0;phase<6;phase++){
 run(`practice=${phase};startGame();state='playing';game.invul=100000;for(let i=0;i<1000;i++)step()`);
 assert.ok(run('game.bullets.length>0'),`phase ${phase} must emit bullets`);
 assert.ok(run('game.bullets.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y))'),'finite bullet movement');
 assert.equal(run('bossLives()'),3-Math.floor(phase/2),'three boss lives, one per nonspell/spell pair');
 if(phase%2===0)assert.ok(run("game.bullets.some(b=>b.shape==='star')"),'nonspell contains stars');
 if(phase===1)assert.ok(run('game.bullets.some(b=>b.homing>0)'),'cat spell emits homing charms');
 if(phase===3){
  assert.equal(run('game.familiars.length'),2,'survival activates second chasing familiar');
  assert.equal(run('game.hp'),1,'survival boss remains invulnerable');
 }
 const bombs=run('game.bombs');run("keys.add('x');step()");assert.equal(run('game.bombs'),bombs-1,'bomb consumes one charge');
 assert.equal(run('game.bullets.length'),0,'bomb clears bullets');
}
run("practice=3;startGame();game.transition=0;phaseDamage(99999);keys.add('x');step()");
assert.equal(run('game.hp'),1,'bomb cannot damage survival boss');
run("keys.clear();game.invul=100000;game.bomb=0;for(let i=game.phaseFrame;i<PHASES[3].time*60;i++)step()");
assert.equal(run('state'),'result','survival clears on timeout');
run("practice=-1;startGame();state='playing';game.phase=1;game.hp=0;game.transition=0;step()");
assert.equal(run('bossLives()'),2,'first spell defeat consumes exactly one boss life');
assert.equal(run('game.phase'),2,'next life starts with star nonspell');
run("practice=1;startGame();state='playing';game.transition=0;game.hp=1;game.shots.push({x:game.boss.x,y:game.boss.y+13,vx:0,vy:-13,homing:false});step()");
assert.equal(run('state'),'result','defeated practice spell completes');
run("practice=5;startGame();game.phaseFrame=1;emitPattern()");
assert.ok(run("game.bullets.every(b=>b.shape==='rice'&&!b.homing)"),'final spell emits crossing rice rings');
const opening=run('({count:game.bullets.length,speed:Math.hypot(game.bullets[0].vx,game.bullets[0].vy),gap:game.finalNextFrame-game.phaseFrame})');
run('game.bullets=[];game.hp=1;game.finalNextFrame=0;emitPattern()');
assert.ok(run('game.bullets.length')>opening.count,'final spell grows denser at low HP');
assert.ok(run('Math.hypot(game.bullets[0].vx,game.bullets[0].vy)')>opening.speed,'final spell accelerates at low HP');
assert.ok(run('game.finalNextFrame-game.phaseFrame')<opening.gap,'final spell emits more frequently at low HP');
run("practice=-1;replay=false;startGame();state='playing';game.phase=5;game.hp=0;game.transition=0;step()");
assert.equal(run('state'),'ending','full clear enters ending before results');
assert.equal(run('musicTrack'),'ending','ending selects its soft arrangement');
assert.equal(run('record.result'),'clear','clear saved before ending');
const finalScore=run('game.score');
assert.match(run("$('#overlay').innerHTML"),/禁鐘，終於安靜了/,'epilogue rendered');
run('nextEnding();nextEnding()');
assert.match(run("$('#overlay').innerHTML"),/作者/,'author credit rendered');
run('nextEnding()');
assert.match(run("$('#overlay').innerHTML"),/and you/,'player thanked');
if(process.argv.includes('--preview'))fs.writeFileSync('ed-preview.html',`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/dist/"><link rel="stylesheet" href="style.css"><title>ED Preview</title></head><body><main style="padding-top:30px"><section id="stage"><div id="overlay">${run("$('#overlay').innerHTML")}</div></section></main></body></html>`);
run('nextEnding()');
assert.equal(run('state'),'result','ending finishes at results');
assert.equal(run('game.score'),finalScore,'ending never awards the clear bonus twice');
run("replay=true;finish('clear')");
assert.equal(run('state'),'result','replay ends at results without opening credits');
console.log('PASS: intro, replay, three lives, stars, homing, survival, bombs, final-spell escalation, ending/credits/results');

