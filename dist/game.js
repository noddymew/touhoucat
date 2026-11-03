'use strict';
const $=s=>document.querySelector(s),canvas=$('#canvas'),ctx=canvas.getContext('2d'),title=$('#titleScreen'),overlay=$('#overlay'),cat=new Image();cat.src='assets/cat.png';
const campus=new Image();campus.src='assets/imperial-university.jpg';
const STAGE={name:'帝國大學',jp:'帝國大学 — 禁鐘のアカデミア',subtitle:'第零結界・叡智ノ果テニ眠ル獣',bgm:'東方疾走貓'};
const REPLAY_VERSION=3;
const MENU=[['Game Start','開始遊戲'],['Extra Start','額外挑戰'],['Practice Start','符卡練習'],['Replay','重播紀錄'],['Player Data','遊玩紀錄'],['Music Room','音樂室'],['Option','設定'],['Quit','離開']];
let data;try{data=JSON.parse(localStorage.getItem('catdog-data'))||{}}catch{data={}}
data={plays:0,clears:0,high:0,spells:0,...data};let options={volume:.35,auto:false,...data.options};
let endingIndex=0,endingTime=0;
let state='title',selection=0,keys=new Set(),game=null,accumulator=0,lastTime=0,visualTime=0,dialogueIndex=0,chosen='Normal',practice=-1,extra=false,replay=false,record=null,playback=null,musicTrack='title';
const FIELD={x:56,y:32,w:770,h:736},CX=441,TAU=Math.PI*2;
const PHASES=[
 {name:'非符「奇跡の星詠み」',hp:800,time:32,color:'#a2e7dc'},
 {name:'貓符「ババ狗」',hp:1300,time:45,color:'#ffba76'},
 {name:'非符「禁鐘に降る五芒星」',hp:1000,time:34,color:'#b4b5ff'},
 {name:'時符「禁鐘に踊る双つの影」',hp:1,time:45,color:'#ff8d99',survival:true},
 {name:'非符「帝都の星辰結界」',hp:1200,time:36,color:'#a4d6ff'},
 {name:'終符「帝國を翔ける猫神の神徳」',hp:2100,time:60,color:'#ffdc92'}
];
function bossLives(){return 3-Math.floor(game.phase/2)}
function phaseDamage(amount){if(game.transition===0&&!PHASES[game.phase].survival)game.hp-=amount}
function finishIntro(){if(state!=='intro')return;state='dialogue';showDialogue()}

function save(){try{data.options=options;localStorage.setItem('catdog-data',JSON.stringify(data))}catch{toast('瀏覽器儲存空間不足，本次紀錄僅保留於記憶體。')}}
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),2600)}
function panel(eye,heading,body){overlay.hidden=false;overlay.innerHTML=`<div class="panel"><div class="eyeline">${eye}</div><h2>${heading}</h2>${body}</div>`;overlay.querySelector('button')?.focus()}
function backButton(){return '<button id="back">返回標題</button>'}
function bindBack(){$('#back')?.addEventListener('click',showTitle)}
function showTitle(){if(game&&['playing','pause','dialogue'].includes(state)&&!replay&&record){record=null}state='title';game=null;keys.clear();title.hidden=false;overlay.hidden=true;musicTrack='title';drawMenu()}
function drawMenu(){$('#menu').innerHTML=MENU.map((m,i)=>`<button class="${i===selection?'active':''}" data-menu="${i}">${m[0]}<small>${m[1]}</small></button>`).join('');$('#menu').querySelectorAll('button').forEach(b=>{b.addEventListener('pointerenter',()=>{selection=+b.dataset.menu;$('#menu').querySelectorAll('button').forEach((x,i)=>x.classList.toggle('active',i===selection))});b.onclick=()=>activate(+b.dataset.menu)})}
function activate(i){sound.start();switch(i){case 0:extra=false;practice=-1;chooseDifficulty();break;case 1:extra=true;practice=-1;chooseDifficulty();break;case 2:state='menu';panel('SPELL PRACTICE','符卡練習',`<p>三條命，三張符卡。時間符卡需存活 45 秒。</p>${PHASES.map((p,i)=>i%2?`<button data-phase="${i}">${p.name}</button>`:'').join('')}<br>${backButton()}`);overlay.querySelectorAll('[data-phase]').forEach(b=>b.onclick=()=>{practice=+b.dataset.phase;extra=false;chosen='Normal';startGame()});bindBack();break;case 3:showReplays();break;case 4:state='menu';panel('PLAYER RECORD','巫女的手帳',`<table><tr><td>出擊次數</td><td>${data.plays}</td></tr><tr><td>異變解決</td><td>${data.clears}</td></tr><tr><td>符卡收取</td><td>${data.spells}</td></tr><tr><td>最高分數</td><td>${String(data.high).padStart(9,'0')}</td></tr></table>${backButton()}`);bindBack();break;case 5:musicRoom();break;case 6:settings();break;case 7:state='menu';panel('SEE YOU IN GENSOKYO','暫別幻想鄉',`<p>感謝遊玩《東方貓貓狗》。<br>你的最高分與重播已自動保存在這個瀏覽器。<br>可以關閉此分頁，或再來一場彈幕對決。</p>${backButton()}`);bindBack()}}
function chooseDifficulty(){state='menu';panel(extra?'EXTRA STAGE':'SELECT DIFFICULTY',extra?'可愛狗的加班時間':'選擇難度',`<p>博麗靈夢 A · 誘導裝備<br>帝國大學入場 → 簡短對話 → 三條命 Boss 戰</p>${['Easy','Normal','Hard','Lunatic'].map(d=>`<button data-difficulty="${d}" class="${d==='Normal'?'primary':''}">${d}<br><small>${{Easy:'悠閒散步',Normal:'午後異變',Hard:'貓咪暴走',Lunatic:'幻想狂宴'}[d]}</small></button>`).join('')}<p>Z 射擊 · Shift 低速 · X 靈擊 · Esc 暫停<br>Extra 模式追加彈速與密度，開放直接挑戰。</p>${backButton()}`);overlay.querySelectorAll('[data-difficulty]').forEach(b=>b.onclick=()=>{chosen=b.dataset.difficulty;startGame()});bindBack()}
function settings(returnToGame=false){const was=state;state='menu';panel('CONFIGURATION','環境設定',`<label class="row">音樂音量 <input id="volume" type="range" min="0" max="100" value="${options.volume*100}"></label><label class="row">自動射擊 <input id="autofire" type="checkbox" ${options.auto?'checked':''}></label><p>鍵盤方向鍵／WASD 移動，Z 射擊，Shift 低速。<br>判定點只有身體中央的小圓點；擦彈可獲得加分。<br>觸控裝置可拖動戰鬥區移動，並使用下方按鈕。</p><button id="configBack" class="primary">${returnToGame?'回到暫停選單':'儲存並返回'}</button>`);$('#volume').oninput=e=>{options.volume=+e.target.value/100;sound.update()};$('#autofire').onchange=e=>options.auto=e.target.checked;$('#configBack').onclick=()=>{save();if(returnToGame){state=was;pause()}else showTitle()}}
function musicRoom(){state='menu';panel('ORIGINAL SOUNDTRACK','音樂室',`<p>為這場異變寫下的原創合成樂。<br>明亮的主旋律、快速琶音與疾走節奏。</p><button id="song1" class="primary">01　貓影下的博麗神社</button><button id="song2">02　東方疾走貓</button><p id="trackInfo">NOW PLAYING · 貓影下的博麗神社</p>${backButton()}`);$('#song1').onclick=()=>{musicTrack='title';sound.reset();$('#trackInfo').textContent='NOW PLAYING · 貓影下的博麗神社'};$('#song2').onclick=()=>{musicTrack='boss';sound.reset();$('#trackInfo').textContent='NOW PLAYING · 東方疾走貓'};bindBack()}
function showReplays(){state='menu';const r=data.replay?.version===REPLAY_VERSION?data.replay:null;panel('REPLAY THE FANTASY','重播紀錄',r?`<p>最近一次出擊 · ${r.date}<br>${r.difficulty}${r.extra?' / EXTRA':''} · ${r.result==='clear'?'異變解決':'挑戰結束'} · ${r.score.toLocaleString()} 分<br>重播會依照當時的操作重新演算戰鬥。</p><button id="watch" class="primary">▶ 播放重播</button>${backButton()}`:`<p>還沒有本版本的重播。完成一次出擊後會自動儲存。<br>紀錄保存在此瀏覽器。</p>${backButton()}`);if(r)$('#watch').onclick=()=>{chosen=r.difficulty;extra=r.extra;practice=r.practice;playback=r;startGame(true)};bindBack()}
const dialogue=[['博麗靈夢','帝國大學……禁鐘響起，怎麼連校門也被貓占領了？'],['可愛狗 · 玳瑁貓','喵。'],['博麗靈夢','妳的稱號明明是「可愛狗」吧！'],['可愛狗 · 玳瑁貓','喵嗚！吾乃禁鐘的守護獸——可愛狗！先陪我玩一場！'],['博麗靈夢','真是的。那就用彈幕，來解決這次異變吧。']];
function startGame(isReplay=false){replay=isReplay;keys.clear();title.hidden=true;overlay.hidden=true;musicTrack='boss';sound.start();sound.reset();const factor={Easy:.7,Normal:1,Hard:1.28,Lunatic:1.6}[chosen]*(extra?1.22:1);game={frame:0,phase:practice>=0?practice:0,phaseFrame:0,hp:PHASES[practice>=0?practice:0].hp,boss:{x:CX,y:160},player:{x:CX,y:654},bullets:[],shots:[],sparks:[],familiars:[],introFrame:0,lives:chosen==='Easy'?6:4,bombs:3,score:0,graze:0,invul:160,bomb:0,transition:100,captured:0,phaseMiss:false,factor,seed:23473,touch:null,replayIndex:0};if(!replay){data.plays++;save();record={version:REPLAY_VERSION,difficulty:chosen,extra,practice,events:[],date:new Date().toLocaleString('zh-TW'),score:0,result:''}}dialogueIndex=0;if(practice>=0||replay){state='playing'}else{state='intro'}}
function showDialogue(){overlay.hidden=false;overlay.style.background='transparent';overlay.style.backdropFilter='none';overlay.innerHTML=`<div class="dialogue"><h3>${dialogue[dialogueIndex][0]}</h3><p>${dialogue[dialogueIndex][1]}</p><small>按 Z ／ Enter 或點擊繼續　 ▷</small></div>`;overlay.onclick=e=>{if(e.target.closest('.dialogue'))nextDialogue()}}
function nextDialogue(){if(state!=='dialogue')return;if(++dialogueIndex>=dialogue.length){state='playing';overlay.hidden=true;overlay.onclick=null;overlay.style.background='';overlay.style.backdropFilter=''}else showDialogue()}
function rand(){game.seed=(Math.imul(game.seed,1664525)+1013904223)>>>0;return game.seed/4294967296}
function bullet(x,y,a,s,color,r=5,curve=0){game.bullets.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r,color,curve,grazed:false,age:0,shape:'orb'})}
function ring(n,a,s,color,r=5,curve=0){for(let i=0;i<n;i++)bullet(game.boss.x,game.boss.y,a+i*TAU/n,s,color,r,curve)}
function aimed(n,spread,s,color){const g=game,a=Math.atan2(g.player.y-g.boss.y,g.player.x-g.boss.x);for(let i=0;i<n;i++)bullet(g.boss.x,g.boss.y,a+(i-(n-1)/2)*spread,s,color,6)}
function starBullet(x,y,a,s,color,r=7,curve=0){bullet(x,y,a,s,color,r,curve);game.bullets.at(-1).shape='star'}
function radialAt(x,y,n,a,s,color,r=5,shape='orb'){for(let j=0;j<n;j++){bullet(x,y,a+j*TAU/n,s,color,r);game.bullets.at(-1).shape=shape}}
function emitPattern(){
 const g=game,t=g.phaseFrame,f=g.factor,p=g.phase,b=g.boss;
 if(p%2===0){
  // Rotating five-point star waves alternate with aimed star fans.
  const gap=Math.max(16,Math.round((p===4?32:44)/f));
  if(t%gap===0){const arms=5,perArm=Math.round((p===4?5:4)*f),rotation=t*(p===2?-.008:.009);
   for(let arm=0;arm<arms;arm++)for(let k=0;k<perArm;k++){
    const a=arm*TAU/arms+rotation+(k-(perArm-1)/2)*.065;
    starBullet(b.x,b.y,a,(1.3+k*.22)*f,['#9de9d8','#c4b4ff','#ffe0a1'][p/2],7,(arm%2?1:-1)*.0015);
   }
  }
  if(t%130===0){const a=Math.atan2(g.player.y-b.y,g.player.x-b.x);for(let j=-3;j<=3;j++)starBullet(b.x,b.y,a+j*.13,2.8*f,'#ffadc8',6)}
 }
 if(p===1){
  if(t%Math.round(55/f)===0)radialAt(b.x,b.y,Math.round(18*f),t*.013,1.45*f,'#f3d293');
  if(t%Math.round(80/f)===0){for(let j=-2;j<=2;j++){bullet(b.x,b.y,Math.PI/2+j*.45,2.4*f,'#ffb87c',6);Object.assign(g.bullets.at(-1),{homing:85,turn:.018,shape:'charm'})}}
 }
 if(p===3&&t%100===0)radialAt(b.x,b.y,Math.round(14*f),t*.005,1.15*f,'#bdc3f5',5);
 if(p===5){
  // Alternating overlapping rice-bullet rings tighten as HP drops or time passes.
  const pressure=Math.min(1,Math.max(1-g.hp/PHASES[p].hp,t/(PHASES[p].time*60)));
  if(t>=(g.finalNextFrame||0)){
   const wave=g.finalWave||0,n=Math.round((22+pressure*8)*f),colors=['#8be4bc','#9acfff','#e3a5ed','#ffb5ce','#ffe29c'];
   for(let layer=0;layer<2;layer++)for(let j=0;j<n;j++){
    const angle=j*TAU/n+wave*.13+layer*Math.PI/n;
    bullet(b.x,b.y,angle,(1.6+pressure*1.1+layer*.24)*f,colors[(wave+layer)%colors.length],4.5,layer?.0006:-.0006);
    game.bullets.at(-1).shape='rice';
   }
   g.finalWave=wave+1;g.finalNextFrame=t+Math.max(14,Math.round((48-pressure*24)/f));
  }
 }

}
function updateFamiliars(){
 const g=game,t=g.phaseFrame,p=g.phase;if(p!==1&&p!==3)return;
 const total=p===1?2:(t>12*60?2:1);
 while(g.familiars.length<total){const i=g.familiars.length;g.familiars.push({x:CX+(i?130:-130),y:210,age:0,delay:i*85,tx:CX,ty:500,mode:'wait',index:i})}
 for(const a of g.familiars){
  if(a.delay>0){a.delay--;continue}
  const cycle=a.age%210;
  if(cycle===0||a.mode==='wait'){a.sx=a.x;a.sy=a.y;a.tx=g.player.x;a.ty=g.player.y;a.mode='mark'}
  if(cycle<48)a.mode='mark';
  else if(cycle<100){a.mode='dash';const u=(cycle-48)/52,ease=u*u*(3-2*u);a.x=a.sx+(a.tx-a.sx)*ease;a.y=a.sy+(a.ty-a.sy)*ease;
   if(cycle%12===0&&g.bomb===0){if(p===3){bullet(a.x,a.y,a.index?0:Math.PI,.24,'#ff657d',8);Object.assign(g.bullets.at(-1),{fuse:100,shape:'seed'})}else{const angle=Math.atan2(g.player.y-a.y,g.player.x-a.x);for(let j=-1;j<=1;j++){bullet(a.x,a.y,angle+j*.42,1.7*g.factor,'#ffb978',5);Object.assign(g.bullets.at(-1),{homing:55,turn:.012,shape:'charm'})}}}
  }else a.mode='rest';
  if(g.bomb===0&&a.mode!=='mark'&&Math.hypot(a.x-g.player.x,a.y-g.player.y)<20)hitPlayer();
  a.age++;
 }
}
function hitPlayer(){const g=game;if(g.invul>0||g.bomb>0)return;g.lives--;g.invul=160;g.phaseMiss=true;g.bombs=Math.max(g.bombs,3);spark(g.player.x,g.player.y,'#ff9aaf',24);sound.fx(80,.2);if(g.lives<=0)finish('over')}

function inputMask(){let m=0;if(keys.has('ArrowLeft')||keys.has('a'))m|=1;if(keys.has('ArrowRight')||keys.has('d'))m|=2;if(keys.has('ArrowUp')||keys.has('w'))m|=4;if(keys.has('ArrowDown')||keys.has('s'))m|=8;if(keys.has('Shift'))m|=16;if(keys.has('z')||options.auto)m|=32;if(keys.has('x'))m|=64;return m}
function spark(x,y,color,n=12){for(let i=0;i<n;i++){let a=i*TAU/n;game.sparks.push({x,y,vx:Math.cos(a)*2,vy:Math.sin(a)*2,life:30,color})}}
function step(){const g=game;if(!g)return;if(state==='intro'){if(++g.introFrame>=270)finishIntro();return}if(state!=='playing')return;let m;if(replay){while(g.replayIndex<playback.events.length&&playback.events[g.replayIndex][0]<=g.frame){const ev=playback.events[g.replayIndex++];g.mask=ev[1];g.touch=ev.length>2?{x:ev[2],y:ev[3]}:null}m=g.mask||0}else{m=inputMask();const pos=g.touch;const signature=`${m}:${pos?.x??''}:${pos?.y??''}`;if(signature!==g.signature){record.events.push(pos?[g.frame,m,pos.x,pos.y]:[g.frame,m]);g.signature=signature}}
 g.frame++;g.invul=Math.max(0,g.invul-1);g.bomb=Math.max(0,g.bomb-1);const pl=g.player,speed=m&16?2.3:5,dx=((m&2)?1:0)-((m&1)?1:0),dy=((m&8)?1:0)-((m&4)?1:0),norm=dx&&dy?Math.SQRT1_2:1;pl.x+=dx*speed*norm;pl.y+=dy*speed*norm;if(g.touch){pl.x=g.touch.x;pl.y=g.touch.y}pl.x=Math.max(FIELD.x+12,Math.min(FIELD.x+FIELD.w-12,pl.x));pl.y=Math.max(FIELD.y+20,Math.min(FIELD.y+FIELD.h-18,pl.y));g.focus=!!(m&16);
 if(m&64&&!(g.previousMask&64)&&g.bombs>0){g.bombs--;g.bomb=150;g.invul=180;g.phaseMiss=true;g.bullets=[];phaseDamage(220);sound.fx(180,.3)}g.previousMask=m;
 if(m&32&&g.frame%6===0){for(let j=-1;j<=1;j+=2)g.shots.push({x:pl.x+j*10,y:pl.y-15,vx:0,vy:-13,homing:false});if(g.frame%12===0)for(let j=-1;j<=1;j+=2)g.shots.push({x:pl.x+j*30,y:pl.y-5,vx:j*3.5,vy:-5,homing:true})}
 g.boss.x=CX+Math.sin(g.frame*.009)*160;g.boss.y=154+Math.sin(g.frame*.015)*24;
 if(g.transition>0){g.transition--}else{g.phaseFrame++;emitPattern();updateFamiliars();if(state!=='playing')return}
 for(const s of g.shots){if(s.homing){let a=Math.atan2(g.boss.y-s.y,g.boss.x-s.x);s.vx+=(Math.cos(a)*8-s.vx)*.12;s.vy+=(Math.sin(a)*8-s.vy)*.12}s.x+=s.vx;s.y+=s.vy;if(Math.hypot(s.x-g.boss.x,s.y-g.boss.y)<46&&g.transition===0){phaseDamage(s.homing?5:3);if(!PHASES[g.phase].survival)g.score+=25;s.y=-100}}
 g.shots=g.shots.filter(s=>s.y>-50&&s.y<850&&s.x>-50&&s.x<900);
 const bursts=[];
 for(const b of g.bullets){
  b.age++;
  if(b.homing&&b.age<=b.homing){const current=Math.atan2(b.vy,b.vx),target=Math.atan2(pl.y-b.y,pl.x-b.x),delta=Math.atan2(Math.sin(target-current),Math.cos(target-current)),angle=current+Math.max(-b.turn,Math.min(b.turn,delta)),speed=Math.hypot(b.vx,b.vy);b.vx=Math.cos(angle)*speed;b.vy=Math.sin(angle)*speed}
  if(b.curve){const c=Math.cos(b.curve),s=Math.sin(b.curve),vx=b.vx;b.vx=vx*c-b.vy*s;b.vy=vx*s+b.vy*c}
  b.x+=b.vx;b.y+=b.vy;
  if(b.fuse&&b.age>=b.fuse){bursts.push({x:b.x,y:b.y});b.y=-2000;continue}
  const d=Math.hypot(b.x-pl.x,b.y-pl.y);if(!b.grazed&&d<25&&d>b.r+3){b.grazed=true;g.graze++;g.score+=100}if(d<b.r+3)hitPlayer();if(state!=='playing')return;
 }
 for(const b of bursts)if(g.bomb===0)radialAt(b.x,b.y,Math.round(9*g.factor),g.phaseFrame*.01,1.75*g.factor,'#9ef1b7',4);

 g.bullets=g.bullets.filter(b=>b.x>FIELD.x-30&&b.x<FIELD.x+FIELD.w+30&&b.y>FIELD.y-90&&b.y<FIELD.y+FIELD.h+30);
 for(const p of g.sparks){p.x+=p.vx;p.y+=p.vy;p.life--}g.sparks=g.sparks.filter(p=>p.life>0);
 if(g.bomb>0)phaseDamage(1.2);
 if(g.transition===0&&((!PHASES[g.phase].survival&&g.hp<=0)||g.phaseFrame>=PHASES[g.phase].time*60)){
  const defeated=g.hp<=0||PHASES[g.phase].survival;
  if(defeated){g.score+=30000;if(g.phase%2&&!g.phaseMiss){g.captured++;g.score+=50000;if(!replay){data.spells++;save()}toast('SPELL CARD CAPTURE!　符卡收取 +50,000')}}
  g.bullets=[];g.familiars=[];spark(g.boss.x,g.boss.y,'#ffe6ae',40);
  if(practice>=0||g.phase===PHASES.length-1){finish('clear');return}
  if(g.phase%2)toast(`BOSS BREAK　剩餘 ${bossLives()-1} 條命`);
  g.phase++;g.hp=PHASES[g.phase].hp;g.phaseFrame=0;g.transition=140;g.phaseMiss=false;
 }
}


function finish(result){const g=game;state='result';g.score+=result==='clear'?g.lives*20000:0;if(!replay){data.high=Math.max(data.high,g.score);if(result==='clear'&&practice<0)data.clears++;record.result=result;record.score=g.score;record.endFrame=g.frame;data.replay=record;save()}if(result==='clear'&&practice<0&&!replay){startEnding();return}showResult(result)}
function showResult(result){const g=game;state='result';overlay.style.background='';overlay.style.backdropFilter='';panel(replay?'REPLAY COMPLETE':result==='clear'?'STAGE CLEAR':'GAME OVER',result==='clear'?'異變，解決了。':'再來一場彈幕吧。',`<p>${result==='clear'?'「喵。」<br>靈夢：好啦，妳是全世界最可愛的狗。':'可愛狗：喵嗚！下次再陪我玩吧。'}</p><div class="row"><span>SCORE</span><strong>${g.score.toLocaleString()}</strong></div><div class="row"><span>擦彈 ／ 符卡收取</span><span>${g.graze} ／ ${g.captured}</span></div><p>${replay?'重播播放完畢。':'最高分與本次操作重播已自動儲存。'}</p><button id="again" class="primary">再次挑戰</button>${backButton()}`);$('#again').onclick=()=>startGame(false);bindBack()}
const ENDING=[
 {label:'ENDING 01 / 禁鐘のあとに',title:'禁鐘，終於安靜了。',body:'最後一枚星彈在鐘塔前消散。<br>帝國大學的天空，重新找回午後的顏色。<br><br>靈夢：「所以，妳到底是貓還是狗？」<br>可愛狗：「喵。」',foot:'帝國大学 — 禁鐘のアカデミア'},
 {label:'ENDING 02 / 小さな約束',title:'異變的終點，是下一次相遇。',body:'玳瑁貓收起了式神，蜷在校門前打了個呵欠。<br>靈夢嘆了一口氣，還是替牠留了一個位置。<br><br>「下次想找人玩，就直接來神社吧。」<br>風穿過長廊。這一次，沒有任何彈幕。',foot:'東方貓貓狗　—　GOOD END'},
 {label:'STAFF / 制作',title:'作者',body:'東方貓貓狗<br>企劃・原案・角色設定<br><br>樂曲「東方疾走貓」<br>原創合成配樂<br><br>原作：東方 Project',foot:'Thank you for playing.'},
 {label:'SPECIAL THANKS',title:'and you',body:'謝謝你，陪可愛狗玩到最後。<br>この幻想を、最後まで見届けてくれたあなたへ。',foot:'また、幻想郷で。　／　THE END'}
];
function startEnding(){state='ending';keys.clear();game.bullets=[];game.familiars=[];endingIndex=0;endingTime=0;musicTrack='ending';sound.reset();showEnding()}
function showEnding(){const scene=ENDING[endingIndex];overlay.hidden=false;overlay.style.background='';overlay.style.backdropFilter='';overlay.onclick=null;overlay.innerHTML=`<div class="ending" data-scene="${endingIndex}"><div class="ending-image"></div><div class="ending-copy"><div class="eyeline">${scene.label}</div><h2>${scene.title}</h2><p>${scene.body}</p><div class="ending-foot">${scene.foot}</div><div class="ending-controls"><span>${endingIndex+1} / ${ENDING.length}　 ·　 Z / ENTER 繼續</span><button id="edNext">${endingIndex===ENDING.length-1?'查看成績':'下一幕 →'}</button><button id="edSkip">跳過 ED</button></div></div></div>`;$('#edNext').onclick=nextEnding;$('#edSkip').onclick=()=>showResult('clear')}
function nextEnding(){if(state!=='ending')return;endingTime=0;if(++endingIndex>=ENDING.length){showResult('clear');return}showEnding()}
function pause(){if(!game)return;state='pause';keys.clear();panel('PAUSE','稍作休息',`<p>${replay?'REPLAY · ':''}${chosen} ／ ${PHASES[game.phase].name}</p><button id="resume" class="primary">繼續遊戲</button><button id="retry">重新開始</button><button id="options">設定</button>${backButton()}`);$('#resume').onclick=()=>{state='playing';overlay.hidden=true;keys.clear()};$('#retry').onclick=()=>startGame(replay);$('#options').onclick=()=>settings(true);bindBack()}
function text(s,x,y,size=16,color='#e4e7d6',align='left'){ctx.fillStyle=color;ctx.font=`${size}px Georgia, "Microsoft JhengHei", serif`;ctx.textAlign=align;ctx.fillText(s,x,y)}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill()}
function line(x,y,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke()}
function poly(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill()}
function reimu(x,y,focus,invul){if(invul&&Math.floor(visualTime*15)%2)return;ctx.save();ctx.translate(x,y);ctx.shadowColor='#e7b2bf';ctx.shadowBlur=14;poly([[-12,-10],[-30,16],[-12,13],[0,7],[12,13],[30,16],[12,-10]],'#f5e8da');poly([[-8,-7],[-18,22],[0,17],[18,22],[8,-7]],'#c83f53');poly([[-4,-7],[-5,6],[5,6],[4,-7]],'#f5e5d4');circle(0,-12,10,'#34232e');circle(0,-10,6,'#f2ccad');poly([[-2,-20],[-14,-27],[-15,-15],[0,-18],[15,-15],[14,-27]],'#dc3f51');ctx.shadowBlur=0;line(-4,23,-5,29,'#e8c8ad',3);line(4,23,5,29,'#e8c8ad',3);for(let j=-1;j<=1;j+=2){let a=visualTime*2*j;let ox=Math.cos(a)*31,oy=Math.sin(a)*8;ctx.save();ctx.translate(ox,oy);ctx.rotate(a);ctx.fillStyle='#f8e6c5';ctx.fillRect(-4,-8,8,16);ctx.fillStyle='#d55f64';ctx.fillRect(-2,-4,4,7);ctx.restore()}if(focus){circle(0,1,6,'#fff');circle(0,1,3,'#db4669');ctx.strokeStyle='#f1d6df88';ctx.beginPath();ctx.arc(0,1,21,0,TAU);ctx.stroke()}ctx.restore()}
function background(){
 const bg=ctx.createLinearGradient(0,0,0,800);bg.addColorStop(0,'#172b39');bg.addColorStop(1,'#1b2633');ctx.fillStyle=bg;ctx.fillRect(0,0,1200,800);
 ctx.save();ctx.beginPath();ctx.rect(FIELD.x,FIELD.y,FIELD.w,FIELD.h);ctx.clip();
 if(campus.complete&&campus.naturalWidth){
  const scale=Math.max(FIELD.w/campus.naturalWidth,FIELD.h/campus.naturalHeight)*1.035;
  const w=campus.naturalWidth*scale,h=campus.naturalHeight*scale;
  ctx.drawImage(campus,FIELD.x+(FIELD.w-w)/2,FIELD.y+(FIELD.h-h)/2+Math.sin(visualTime*.12)*8,w,h);
 }
 const tint=ctx.createLinearGradient(0,FIELD.y,0,FIELD.y+FIELD.h);tint.addColorStop(0,'#12243b66');tint.addColorStop(.5,'#18273555');tint.addColorStop(1,'#10212bb0');ctx.fillStyle=tint;ctx.fillRect(FIELD.x,FIELD.y,FIELD.w,FIELD.h);
 for(let i=0;i<20;i++){const x=FIELD.x+(i*173+Math.sin(visualTime*.3+i)*25)%FIELD.w,y=(i*117+visualTime*16)%840-30;circle(x,y,1.4,'#fff0c04a')}
 ctx.restore();ctx.strokeStyle='#b4b9b766';ctx.lineWidth=1;ctx.strokeRect(FIELD.x,FIELD.y,FIELD.w,FIELD.h);
}
function drawStar(x,y,r,rotation,color){ctx.save();ctx.translate(x,y);ctx.rotate(rotation);const points=[];for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.46:r;points.push([Math.cos(a)*rr,Math.sin(a)*rr])}poly(points,color);ctx.restore()}
function drawFamiliars(){for(const a of game.familiars){
 if(a.delay>0)continue;
 if(a.mode==='mark'){
  ctx.setLineDash([7,9]);line(a.x,a.y,a.tx,a.ty,'#ffd1a888',1.5);ctx.setLineDash([]);ctx.strokeStyle='#ffc6a7';ctx.lineWidth=1;ctx.beginPath();ctx.arc(a.tx,a.ty,27,0,TAU);ctx.stroke();text('予兆',a.tx,a.ty-34,11,'#ffe1b6','center');
 }
 ctx.save();ctx.globalAlpha=.8;circle(a.x,a.y,23,'#f79a8433');ctx.beginPath();ctx.arc(a.x,a.y,18,0,TAU);ctx.clip();if(cat.complete&&cat.naturalWidth)ctx.drawImage(cat,a.x-18,a.y-18,36,36);ctx.restore();ctx.strokeStyle=game.phase===3?'#ff899e':'#ffc17c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(a.x,a.y,21,0,TAU);ctx.stroke();
}}
function drawIntro(){
 const g=game;if(state!=='intro')return;
 const alpha=Math.min(1,g.introFrame/40,(270-g.introFrame)/35);ctx.save();ctx.globalAlpha=Math.max(0,alpha);
 const veil=ctx.createLinearGradient(FIELD.x,0,FIELD.x+FIELD.w,0);veil.addColorStop(0,'#0c152ee8');veil.addColorStop(1,'#17202a88');ctx.fillStyle=veil;ctx.fillRect(FIELD.x,255,FIELD.w,290);
 line(110,285,770,285,'#cbb99088');text('STAGE 01  /  THE FORBIDDEN ACADEMIA',CX,319,13,'#e4cea4','center');
 text(STAGE.name,CX,382,54,'#fff1da','center');text(STAGE.jp,CX,425,22,'#ead9b9','center');text(STAGE.subtitle,CX,460,16,'#bdc9df','center');
 text('BGM ♪  '+STAGE.bgm,CX,505,17,'#e8dabb','center');line(110,524,770,524,'#cbb99088');text('Z / ENTER　開始對話',CX,580,12,'#e7dfd0','center');ctx.restore();
}

function draw(){background();if(!game)return;const g=game,p=PHASES[g.phase];ctx.save();ctx.beginPath();ctx.rect(FIELD.x,FIELD.y,FIELD.w,FIELD.h);ctx.clip();
 ctx.save();ctx.translate(g.boss.x,g.boss.y);ctx.rotate(visualTime*.3);ctx.strokeStyle=p.color+'99';ctx.lineWidth=1;for(let j=0;j<2;j++){ctx.beginPath();ctx.arc(0,0,53+j*8,0,TAU);ctx.stroke()}for(let j=0;j<8;j++){let a=j*TAU/8;line(Math.cos(a)*66,Math.sin(a)*66,Math.cos(a)*76,Math.sin(a)*76,p.color)}ctx.restore();ctx.save();ctx.beginPath();ctx.arc(g.boss.x,g.boss.y,39,0,TAU);ctx.clip();if(cat.complete&&cat.naturalWidth)ctx.drawImage(cat,g.boss.x-41,g.boss.y-41,82,82);ctx.restore();
 for(const s of g.shots){ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.atan2(s.vy,s.vx)+Math.PI/2);ctx.shadowColor=s.homing?'#ff9bbb':'#e7e8b9';ctx.shadowBlur=8;ctx.fillStyle=s.homing?'#fff4df':'#a7e8df';ctx.fillRect(-3,-10,6,20);if(s.homing){ctx.fillStyle='#dc5568';ctx.fillRect(-1,-6,2,9)}ctx.restore()}
 drawFamiliars();reimu(g.player.x,g.player.y,g.focus,g.invul);
 for(const b of g.bullets){
  if(b.shape==='star'){drawStar(b.x,b.y,b.r*1.6,b.age*.045,b.color);drawStar(b.x,b.y,b.r*.75,b.age*.045,'#fff7df');continue}
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));ctx.fillStyle=b.color;
  if(b.shape==='charm'){ctx.fillRect(-b.r*1.5,-b.r*.75,b.r*3,b.r*1.5);ctx.fillStyle='#fff3d9';ctx.fillRect(-b.r,-1,b.r*2,2)}
  else{ctx.beginPath();ctx.ellipse(0,0,b.r*(b.shape==='rice'?2:1.3),b.r*(b.shape==='rice'?.65:1),0,0,TAU);ctx.fill();circle(-1,0,b.r*.45,'#fff3e2');if(b.shape==='seed'){ctx.strokeStyle='#ff9aac88';ctx.beginPath();ctx.arc(0,0,b.r+3+4*Math.sin(b.age*.13),0,TAU);ctx.stroke()}}
  ctx.restore();
 }

 for(const s of g.sparks){ctx.globalAlpha=s.life/30;circle(s.x,s.y,2.5,s.color)}ctx.globalAlpha=1;
 if(g.bomb>0){ctx.strokeStyle=`rgba(245,218,154,${g.bomb/150})`;ctx.lineWidth=12;ctx.beginPath();ctx.arc(g.player.x,g.player.y,(150-g.bomb)*7,0,TAU);ctx.stroke();ctx.fillStyle=`rgba(255,238,201,${g.bomb/900})`;ctx.fillRect(FIELD.x,FIELD.y,FIELD.w,FIELD.h);text('霊撃「夢想封印」',CX,420,36,'#fff1c9','center')}
 if(g.transition>0&&state!=='intro'&&state!=='dialogue'){ctx.fillStyle='#0d212b99';ctx.fillRect(56,325,770,115);text(g.phase%2?'SPELL CARD':'BOSS ENCOUNTER',CX,355,12,p.color,'center');text(p.name,CX,397,25,'#f7e4c5','center');if(p.survival)text('耐久符卡 — Boss 無敵 · 撐過 45 秒',CX,426,14,'#ffb9b9','center')}
 if(state==='dialogue'){text('可愛狗',g.boss.x,g.boss.y-65,18,'#f1d6ac','center')}
 drawIntro();ctx.restore();ctx.fillStyle='#0b1c24bb';ctx.fillRect(FIELD.x+8,FIELD.y+8,FIELD.w-16,49);text('玳瑁貓  /  可愛狗',FIELD.x+20,FIELD.y+28,13,'#dbe1ce');text(`${Math.max(0,Math.ceil(p.time-g.phaseFrame/60))}`,FIELD.x+FIELD.w-22,FIELD.y+34,25,'#f6e2bc','right');ctx.fillStyle='#56756b';ctx.fillRect(FIELD.x+20,FIELD.y+38,FIELD.w-85,4);ctx.fillStyle=p.color;ctx.fillRect(FIELD.x+20,FIELD.y+38,(FIELD.w-85)*Math.max(0,g.hp/p.hp),4);text('BOSS LIFE  '+ '◆ '.repeat(bossLives())+'  '+bossLives()+'/3',FIELD.x+20,FIELD.y+76,14,'#ffe3ad');if(p.survival)text('SURVIVAL / 無敵',FIELD.x+FIELD.w-20,FIELD.y+76,13,'#ffc4cb','right');
 const sx=864;text('東方貓貓狗',sx,85,33,'#ede3c6');text('F E L I N E   F A I T H',sx+3,113,10,'#859f96');line(sx,140,1150,140,'#73908755');text(`${replay?'REPLAY / ':''}${extra?'EXTRA · ':''}${chosen.toUpperCase()}`,sx,177,13,'#d8c38d');text('HI SCORE',sx,220,10,'#849c94');text(String(Math.max(data.high,g.score)).padStart(9,'0'),1150,248,25,'#a7bfb2','right');text('SCORE',sx,285,10,'#849c94');text(String(g.score).padStart(9,'0'),1150,319,29,'#f2e2bd','right');line(sx,345,1150,345,'#73908755');text('PLAYER',sx,381,11,'#849c94');text('♥ '.repeat(g.lives),sx,411,22,'#e9a7b2');text('SPELL',sx,451,11,'#849c94');text('✦ '.repeat(g.bombs),sx,480,25,'#d6c593');text('POWER',sx,531,11,'#849c94');text('4.00 / 4.00',1150,531,19,'#e8bdb0','right');text('GRAZE',sx,571,11,'#849c94');text(String(g.graze).padStart(4,'0'),1150,571,20,'#c9d8c3','right');line(sx,600,1150,600,'#73908755');text('博麗靈夢',sx,644,23,'#e4dcc5');text('REIMU A · 誘導裝備',sx,672,12,'#97b1a6');text('帝國大学 — 禁鐘のアカデミア',sx,707,13,'#e4cfaa');text('BGM  '+STAGE.bgm,sx,730,11,'#a0afa0');text('非官方東方同人 · 原創配樂',sx,746,10,'#5f7e75');
}
const sound={ctx:null,master:null,enabled:true,tick:0,next:0,timer:null,start(){if(!this.ctx){try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);this.next=this.ctx.currentTime;this.timer=setInterval(()=>this.schedule(),60)}catch{return}}this.ctx.resume();this.update()},update(){if(this.master)this.master.gain.setTargetAtTime(this.enabled?options.volume*.23:0,this.ctx.currentTime,.1);$('#audio').textContent=this.enabled?'♪ SOUND ON':'♪ SOUND OFF'},reset(){this.tick=0;this.next=this.ctx?this.ctx.currentTime+.05:0},note(midi,time,duration,type='triangle',vol=.25){const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=440*2**((midi-69)/12);g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(vol,time+.008);g.gain.exponentialRampToValueAtTime(.001,time+duration);o.connect(g);g.connect(this.master);o.start(time);o.stop(time+duration+.02)},schedule(){if(!this.ctx||this.ctx.state!=='running')return;if(this.next<this.ctx.currentTime-.3)this.next=this.ctx.currentTime;const boss=musicTrack==='boss',bpm=boss?156:(musicTrack==='ending'?82:118),step=60/bpm/4;const melody=boss?[76,79,83,81,79,76,74,76,79,81,83,86,84,83,81,79,76,74,72,74,76,79,81,79,78,74,71,74,78,81,83,86]:[76,79,81,83,81,79,76,74,72,76,79,81,79,76,74,71,72,74,76,79,76,74,72,67,69,72,76,79,78,74,71,74];const roots=[48,45,53,55];while(this.next<this.ctx.currentTime+.17){const n=this.tick,t=this.next,root=roots[Math.floor(n/32)%4];if(n%2===0){const note=melody[Math.floor(n/2)%melody.length];this.note(note,t,step*2.4,musicTrack==='ending'?'sine':'sawtooth',musicTrack==='ending'?.2:.12);this.note(note+12,t,step*1.6,'triangle',.07)}this.note(root+[0,7,12,16,19,16,12,7][n%8],t,step*.85,'triangle',.13);if(n%4===0){this.note(root-12,t,step*3,'triangle',.42);this.note(35,t,.09,'sine',.55)}if(n%8===4){this.note(50,t,.055,'triangle',.21);this.note(90,t,.035,'square',.025)}if(boss&&n%2===1)this.note(105,t,.02,'square',.025);this.next+=step;this.tick++}},fx(freq,duration){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain(),t=this.ctx.currentTime;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(35,t+duration);g.gain.setValueAtTime(.15,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration)}};
document.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement)return;const key=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Shift','z','x','Escape','Enter'].includes(key))e.preventDefault();if(e.repeat){keys.add(key);return}sound.start();if(state==='title'){if(key==='ArrowDown'){selection=(selection+1)%MENU.length;drawMenu()}else if(key==='ArrowUp'){selection=(selection+MENU.length-1)%MENU.length;drawMenu()}else if(key==='z'||key==='Enter')activate(selection)}else if(state==='ending'&&(key==='z'||key==='Enter'||key===' '))nextEnding();else if(state==='intro'&&(key==='z'||key==='Enter'||key===' '))finishIntro();else if(state==='dialogue'&&(key==='z'||key==='Enter'||key===' '))nextDialogue();else if(key==='Escape'){if(state==='playing')pause();else if(state==='pause'){state='playing';overlay.hidden=true}else if(state==='menu')showTitle()}else if(state==='playing'&&!replay)keys.add(key)});
document.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));window.addEventListener('blur',()=>{keys.clear();if(state==='playing')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause()});
$('#audio').onclick=()=>{sound.start();sound.enabled=!sound.enabled;sound.update()};$('#full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#app').requestFullscreen()}catch{toast('此瀏覽器未開放全螢幕。')}};$('#home').onclick=e=>{e.preventDefault();if(state==='playing')pause();else showTitle()};
for(const b of document.querySelectorAll('[data-key]')){const k=b.dataset.key;b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);sound.start();if(k==='Escape'){if(state==='playing')pause();else if(state==='pause'){state='playing';overlay.hidden=true}return}if(state==='title'&&k==='z'){activate(selection);return}if(state==='ending'&&k==='z'){nextEnding();return}if(state==='intro'&&k==='z'){finishIntro();return}if(state==='dialogue'&&k==='z'){nextDialogue();return}keys.add(k)};b.onpointerup=b.onpointercancel=()=>keys.delete(k)}
function touchPos(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*1200,y:(e.clientY-r.top)/r.height*800}}canvas.style.touchAction='none';canvas.onpointerdown=e=>{if(state!=='playing'||replay)return;const p=touchPos(e);if(p.x>FIELD.x+FIELD.w)return;canvas.setPointerCapture(e.pointerId);game.touch=p;keys.add('z')};canvas.onpointermove=e=>{if(state==='playing'&&game.touch&&!replay)game.touch=touchPos(e)};canvas.onpointerup=canvas.onpointercancel=()=>{if(game)game.touch=null;keys.delete('z')};
function loop(now){let dt=lastTime?Math.min((now-lastTime)/1000,.1):0;lastTime=now;visualTime+=dt;if(state==='ending'){endingTime+=dt;if(endingTime>=9)nextEnding()}if(state==='playing'||state==='intro'){accumulator+=dt;while(accumulator>=1/60){step();accumulator-=1/60}}else accumulator=0;if(state!=='title'&&game)draw();requestAnimationFrame(loop)}
drawMenu();requestAnimationFrame(loop);
// A small deterministic self-check is callable from the browser console or Node.
globalThis.catdogCheck=()=>{const assert=(v,m)=>{if(!v)throw Error(m)};assert(PHASES.length===6,'six boss phases');assert(PHASES.every(p=>p.hp>0&&p.time>0),'valid phase budgets');assert(MENU.length===8,'complete title menu');assert(FIELD.w>0&&FIELD.h>0,'valid play field');return 'PASS: boss phases, phase budgets, title menu, play field'};
globalThis.catdogDebug=()=>({state,frame:game?.frame,phase:game?.phase,bullets:game?.bullets.length,shots:game?.shots.length,score:game?.score,hp:game?.hp,lives:game?.lives,replay});

