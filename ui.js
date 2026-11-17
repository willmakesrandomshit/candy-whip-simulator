'use strict';
// ===================== HUD =====================
const mini=$('mini').getContext('2d');
function updHUD(dt){
  G.dispCoins+=(S.coins-G.dispCoins)*Math.min(1,dt*8);if(Math.abs(S.coins-G.dispCoins)<1)G.dispCoins=S.coins;
  $('coinv').textContent=fmt(G.dispCoins);$('gemv').textContent=fmt(S.gems);
  $('lvlv').textContent='Lv '+S.level+(S.rebirths?' ★'+S.rebirths:'');$('xpfill').style.width=(S.level>=100?100:S.xp/xpNeed(S.level)*100)+'%';
  const w=curWhip();$('whipinfo').innerHTML='🪢 '+w.name+' · ⚔ '+fmt(w.power*dmgMult());
  $('prompt').textContent=G.prompt||(!document.pointerLockElement&&!G.panel&&!G.cinematic&&G.time<40?'Click the game to capture the mouse':'');
  const sb=document.querySelector('[data-open=shop]');if(sb)sb.style.filter=G.canBuy&&Math.floor(G.time*2)%2?'brightness(1.4)':'';
  const c=$('combo');if(G.combo>=3){c.textContent='x'+G.combo+' COMBO!';c.style.opacity=1}else c.style.opacity=0;
  const ei=eventInfo(),ev=$('event'),mm=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  ev.textContent=ei.active?ei.active.n+' '+mm(ei.left):'Next event in '+mm(ei.left);
  const q=S.quests.list.find(q=>!q.done);const qe=$('quest');
  if(q){const t=QT.find(x=>x.id===q.id);qe.textContent='📜 '+t.txt(q.n)+' ('+fmt(q.p)+'/'+fmt(q.n)+')'}else qe.textContent=S.quests.list.some(q=>!q.claimed)?'📜 Quests done — claim rewards! [Q]':'📜 All daily quests claimed!';
  // minimap
  mini.clearRect(0,0,130,130);mini.save();mini.translate(65,65);mini.rotate(cam.yaw);const sc=65/70;
  const dot=(x,z,c,r)=>{mini.fillStyle=c;mini.beginPath();mini.arc((x-hero.pos.x)*sc,(z-hero.pos.z)*sc,r,0,6.3);mini.fill()};
  dot(0,-38,'#ff4a6a',5);
  for(const e of G.enemies)if(e.alive)dot(e.g.position.x,e.g.position.z,e.isBoss?'#ff0000':e.golden?'#ffd34d':'#b0784a',e.isBoss?6:3);
  for(const c of G.chests)if(c.g.visible)dot(c.x,c.z,'#ffffff',3.5);
  for(const s of G.stars)if(s.g.visible)dot(s.x,s.z,'#fff27a',3);
  mini.restore();mini.fillStyle='#fff';mini.beginPath();mini.arc(65,65,4,0,6.3);mini.fill();
}
const MENU=[['shop','🪢 Shop [B]'],['pets','🐾 Pets [P]'],['quests','📜 Quests [Q]'],['map','🗺 Map [M]'],['ach','🏆 Awards [H]'],['wardrobe','👕 Style [C]'],['stats','📊 Stats [K]'],['settings','⚙ Settings [O]']];
$('menu').innerHTML=MENU.map(m=>`<button data-open="${m[0]}">${m[1]}</button>`).join('');
$('menu').addEventListener('click',e=>{const b=e.target.closest('button');if(b){AU.init();togglePanel(b.dataset.open)}});

// ===================== PANELS =====================
const TITLES={shop:'🪢 Whip Shop',pets:'🐾 Pets',quests:'📜 Quests & Events',map:'🗺 World Map',ach:'🏆 Achievements',wardrobe:'👕 Wardrobe',stats:'📊 Statistics',settings:'⚙ Settings'};
function togglePanel(name){if(!G.started)return;if(G.panel===name)closePanel();else openPanel(name)}
function openPanel(name){G.panel=name;if(document.pointerLockElement)document.exitPointerLock();$('panel').classList.remove('hidden');renderPanel();hero.swing=-1;for(const k in K)K[k]=false}
function closePanel(){G.panel=null;$('panel').classList.add('hidden');saveGame()}
$('pclose').onclick=closePanel;
$('panel').addEventListener('mousedown',e=>{if(e.target.id==='panel')closePanel()});
function renderPanel(){const p=G.panel;if(!p)return;$('ptitle').textContent=TITLES[p];$('pbody').innerHTML=R[p]();}
const swatch=w=>`background:repeating-linear-gradient(45deg,#${w.c1.toString(16).padStart(6,'0')} 0 8px,#${w.c2.toString(16).padStart(6,'0')} 8px 16px)`;
const hex=c=>'#'+c.toString(16).padStart(6,'0');
const canReb=()=>S.whips.some(i=>i>=18&&i<30);
const R={
 shop(){
  let h=`<div class="tabs"><span class="pill" style="font-size:16px">🪙 ${fmt(S.coins)}</span>${canReb()?`<button class="gold" data-act="rebirth">♻ Rebirth (+25% perma coins & damage)</button>`:'<small>Rebirth unlocks when you own Galactic Sugar Whip.</small>'}</div><div class="grid">`;
  for(const w of WHIPS){
    if(w.secret&&!S.whips.includes(30)){h+=`<div class="card lock"><h4>??? Secret Whip</h4><small>Collect all 30 Sugar Stars across the worlds.</small><div class="whipicon" style="background:#999"></div><small>${S.stars.length}/30 stars</small></div>`;continue}
    const own=S.whips.includes(w.id),eq=S.whip===w.id;
    h+=`<div class="card ${eq?'eq':own?'own':''}"><h4>${w.name}</h4><div class="whipicon" style="${swatch(w)}"></div><small>${w.tier} · ⚔ ${fmt(w.power)} · reach ${w.reach.toFixed(1)}</small>`+
     (eq?'<button disabled>Equipped</button>':own?`<button class="green" data-act="equip" data-id="${w.id}">Equip</button>`:`<button class="gold" data-act="buy" data-id="${w.id}" ${S.coins<w.price?'disabled':''}>Buy 🪙 ${fmt(w.price)}</button>`)+'</div>'}
  return h+'</div>'},
 pets(){
  let h=`<div class="tabs"><button class="gold" data-act="hatch" ${S.gems<5?'disabled':''}>🥚 Hatch Egg 💎 5</button><span class="pill" style="font-size:16px">💎 ${S.gems}</span><small>Equipped ${S.equipped.length}/3 · Duplicates level pets up (max Lv 10, +15% bonus per level).</small></div><div class="grid">`;
  for(const p of PETS){const lv=S.pets[p.id]||0,eq=S.equipped.includes(p.id);
   const bon=Object.entries(p.b).map(([k,v])=>`+${Math.round(v*(1+.15*(Math.max(lv,1)-1))*100)}% ${BN[k]}`).join(', ');
   h+=`<div class="card ${eq?'eq':lv?'own':'lock'}"><h4 class="rar${p.r}">${lv?p.n:'???'}</h4><small class="rar${p.r}">${RARITY[p.r].n}${lv?' · Lv '+lv:''}</small><div style="height:26px;border-radius:50%;width:26px;background:${lv?hex(p.c):'#999'}"></div><small>${lv?bon:'Not found yet'}</small>`+
   (lv?`<button class="${eq?'':'green'}" data-act="petEq" data-id="${p.id}">${eq?'Unequip':'Equip'}</button>`:'')+'</div>'}
  return h+'</div>'},
 quests(){ensureQuests();let h='<h3>Daily Quests</h3>';
  for(const q of S.quests.list){const t=QT.find(x=>x.id===q.id);
   h+=`<div class="row ${q.done?'done':''}"><div><b>${t.txt(q.n)}</b><div class="prog"><i style="width:${q.p/q.n*100}%"></i></div><small>${fmt(q.p)}/${fmt(q.n)} · Reward: 💎${q.gem} + 🪙${fmt(q.coins)}</small></div>`+
   (q.claimed?'<span>✔ Claimed</span>':`<button class="gold" data-act="claim" data-id="${S.quests.list.indexOf(q)}" ${q.done?'':'disabled'}>Claim</button>`)+'</div>'}
  const ei=eventInfo();h+='<h3>Limited-Time World Events</h3><div class="row"><div>'+(ei.active?`<b>ACTIVE: ${ei.active.n}</b>`:`<b>Next: ${ei.next?ei.next.n:EVENTS[0].n}</b>`)+`<br><small>Events rotate every 5 minutes of play and last 60 seconds.</small></div></div>`;
  return h},
 map(){
  let h='<div class="grid">';
  WORLDS.forEach((w,i)=>{const un=S.worlds.includes(i);h+=`<div class="card ${S.world===i?'eq':un?'own':'lock'}"><h4>${i+1}. ${w.n}</h4><small>${w.desc}</small><small>Boss: ${w.boss.n}${S.bossKills[i]?' ✔':''}</small><small>Stars: ${S.stars.filter(s=>s.startsWith(i+':')).length}/6</small>`+
   (S.world===i?'<button disabled>You are here</button>':un?`<button class="green" data-act="travel" data-id="${i}">Travel</button>`:`<button class="gold" data-act="unlock" data-id="${i}" ${S.coins<w.cost?'disabled':''}>Unlock 🪙 ${fmt(w.cost)}</button>`)+'</div>'});
  return h+'</div>'},
 ach(){let n=0;let h='';for(const a of ACH){const d=S.ach[a.id];if(d)n++;h+=`<div class="row ${d?'done':''}"><div><b>${d?'🏆':'🔒'} ${a.n}</b><br><small>${a.d}</small></div><span>${d?'+💎2':''}</span></div>`}
  return `<p><b>${n}/${ACH.length}</b> unlocked</p>`+h},
 wardrobe(){
  let h=`<div class="tabs"><span class="pill" style="font-size:16px">💎 ${S.gems}</span></div><h3>Skins</h3><div class="grid">`;
  SKINS.forEach((s,i)=>{const own=S.skins.includes(i);h+=`<div class="card ${S.skin===i?'eq':own?'own':''}"><h4>${s.n}</h4><div style="height:20px;border-radius:8px;background:${s.rainbow?'linear-gradient(90deg,red,yellow,lime,cyan,magenta)':hex(s.c)}"></div>`+(S.skin===i?'<button disabled>Wearing</button>':own?`<button class="green" data-act="skin" data-id="${i}">Wear</button>`:`<button class="gold" data-act="buySkin" data-id="${i}" ${S.gems<s.cost?'disabled':''}>💎 ${s.cost}</button>`)+'</div>'});
  h+='</div><h3>Hats</h3><div class="grid">';
  HATS.forEach((s,i)=>{const own=S.hats.includes(i);h+=`<div class="card ${S.hat===i?'eq':own?'own':''}"><h4>${s.n}</h4>`+(S.hat===i?'<button disabled>Wearing</button>':own?`<button class="green" data-act="hat" data-id="${i}">Wear</button>`:`<button class="gold" data-act="buyHat" data-id="${i}" ${S.gems<s.cost?'disabled':''}>💎 ${s.cost}</button><small>or beat world boss ${i}</small>`)+'</div>'});
  h+='</div><h3>Emotes</h3><div class="tabs">'+EMOTES.map((e,i)=>`<button class="blue" data-act="emote" data-id="${i}">${i+1}. ${e}</button>`).join('')+'</div>';return h},
 stats(){const s=S.stats,t=Math.floor(s.playtime);
  const row=(a,b)=>`<div class="setrow"><span>${a}</span><b>${b}</b></div>`;
  return row('Player level',S.level+' ('+Math.floor(S.xp)+'/'+xpNeed(S.level)+' XP)')+row('Rebirths',S.rebirths+' (×'+rebMult().toFixed(2)+' coins & damage)')+row('Creatures defeated',fmt(s.kills))+row('Whip hits',fmt(s.hits))+row('Best single hit',fmt(s.bestHit))+row('Total coins earned',fmt(s.coinsEarned))+row('Bosses defeated',s.bosses)+row('Golden creatures',s.golden)+row('Best combo','x'+s.maxCombo)+row('Chests opened',s.chests)+row('Sugar Stars',S.stars.length+'/30')+row('Pets hatched',s.eggs)+row('Sugar crashes (deaths)',s.deaths)+row('Play time',Math.floor(t/3600)+'h '+Math.floor(t/60)%60+'m')+
  row('Damage multiplier','×'+dmgMult().toFixed(2))+row('Coin multiplier','×'+coinMult().toFixed(2))+(canReb()?`<p><button class="gold" data-act="rebirth">♻ Rebirth</button></p>`:'')},
 settings(){
  const sl=(k,l)=>`<div class="setrow"><span>${l}</span><input type="range" min="0" max="1" step="0.05" value="${S.settings[k]}" data-set="${k}"></div>`;
  const tg=(k,l)=>`<div class="setrow"><span>${l}</span><input type="checkbox" ${S.settings[k]?'checked':''} data-tog="${k}"></div>`;
  return sl('master','Master volume')+sl('music','Music volume')+sl('sfx','Sound effects')+tg('shake','Screen shake')+tg('flash','Damage flashes')+tg('dmgNums','Floating damage numbers')+tg('autoWhip','Auto-whip when creatures are in reach (accessibility)')+
  `<div class="setrow"><span>UI size</span><input type="range" min="0.8" max="1.4" step="0.1" value="${S.settings.ui}" data-set="ui"></div>`+
  `<div class="setrow"><span>Save data</span><span><button class="green" data-act="save">Save now</button> <button class="blue" data-act="export">Export</button> <button class="blue" data-act="import">Import</button> <button data-act="reset">Reset</button></span></div><small>Autosaves every 10 seconds in this browser.</small>`}
};
// ---- actions ----
const ACT={
 buy(i){const w=WHIPS[i];if(S.whips.includes(i))return;if(S.coins<w.price){AU.err();return}S.coins-=w.price;S.whips.push(i);S.whip=i;buildWhipMeshes();AU.buy();banner('NEW WHIP!',w.name);toast('Bought '+w.name+'!')},
 equip(i){if(!S.whips.includes(i))return;S.whip=i;buildWhipMeshes();AU.buy()},
 rebirth(){if(!canReb())return;if(!confirm('Rebirth? You will lose coins and whips (keeping worlds, pets, cosmetics, gems, level) for a permanent +25% coins & damage and bonus gems.'))return;
  S.rebirths++;const keep=S.whips.includes(30);S.coins=0;S.whips=keep?[0,30]:[0];S.whip=keep?30:0;S.gems+=10*S.rebirths;G.dispCoins=0;buildWhipMeshes();AU.up();banner('REBIRTH!','Permanent bonus x'+rebMult().toFixed(2));checkAch();closePanel()},
 hatch(){if(S.gems<5){AU.err();return}S.gems-=5;S.stats.eggs++;qEvent('egg',1);
  const L=luck();const ws=RARITY.map((r,i)=>r.w*(i>=2?L:1));let t=ws.reduce((a,b)=>a+b,0),r=Math.random()*t,ri=0;for(;ri<ws.length-1;ri++){if(r<ws[ri])break;r-=ws[ri]}
  const pool=PETS.filter(p=>p.r===ri),p=pick(pool);const had=S.pets[p.id]||0;
  if(had){S.pets[p.id]=Math.min(10,had+1);toast('Duplicate '+p.n+'! Now Lv '+S.pets[p.id])}else{S.pets[p.id]=1;if(S.equipped.length<3){S.equipped.push(p.id);rebuildPets()}banner(RARITY[ri].n.toUpperCase()+'!',p.n)}
  AU.up();rebuildPets()},
 petEq(i){const k=S.equipped.indexOf(i);if(k>=0)S.equipped.splice(k,1);else{if(S.equipped.length>=3){toast('Max 3 pets equipped');return}S.equipped.push(i)}rebuildPets()},
 claim(i){const q=S.quests.list[i];if(!q||!q.done||q.claimed)return;q.claimed=true;S.gems+=q.gem;S.coins+=q.coins;AU.buy();toast('Quest reward: 💎'+q.gem+' 🪙'+fmt(q.coins))},
 travel(i){if(travel(i))closePanel()},
 unlock(i){const w=WORLDS[i];if(S.coins<w.cost){AU.err();return}S.coins-=w.cost;S.worlds.push(i);AU.up();travel(i);closePanel()},
 skin(i){S.skin=i;buildHero();rebuildPets()},buySkin(i){const s=SKINS[i];if(S.gems<s.cost){AU.err();return}S.gems-=s.cost;S.skins.push(i);S.skin=i;buildHero();AU.buy()},
 hat(i){S.hat=i;buildHero()},buyHat(i){const s=HATS[i];if(S.gems<s.cost){AU.err();return}S.gems-=s.cost;S.hats.push(i);S.hat=i;buildHero();AU.buy()},
 emote(i){closePanel();G.emote=EMOTES[i];G.emoteT=0},
 save(){saveGame();toast('Saved!')},
 export(){const t=btoa(unescape(encodeURIComponent(JSON.stringify(S))));prompt('Copy your save code:',t)},
 import(){const t=prompt('Paste save code:');if(!t)return;try{const o=JSON.parse(decodeURIComponent(escape(atob(t.trim()))));S=mergeDeep(DEF(),o);saveGame();location.reload()}catch(e){toast('Invalid save code')}},
 reset(){if(confirm('Delete ALL progress?')){localStorage.removeItem(SAVE_KEY);location.reload()}}
};
$('pbody').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b||b.disabled)return;AU.init();const id=b.dataset.id;ACT[b.dataset.act](id!==undefined?+id:undefined);if(G.panel)renderPanel();saveGame()});
$('pbody').addEventListener('input',e=>{const t=e.target;if(t.dataset.set){S.settings[t.dataset.set]=+t.value;AU.vol();if(t.dataset.set==='ui')applyUI()}});
$('pbody').addEventListener('change',e=>{const t=e.target;if(t.dataset.tog){S.settings[t.dataset.tog]=t.checked}});
function applyUI(){document.documentElement.style.setProperty('--ui',S.settings.ui)}

// ===================== INPUT =====================
const PANEL_KEYS={KeyB:'shop',KeyP:'pets',KeyQ:'quests',KeyM:'map',KeyH:'ach',KeyK:'stats',KeyC:'wardrobe',KeyO:'settings'};
addEventListener('keydown',e=>{
  if(!G.started)return;
  if(e.target.tagName==='INPUT'&&e.target.type==='range')return;
  if(e.code==='Escape'){if(G.panel)closePanel();return}
  if(PANEL_KEYS[e.code]&&!e.repeat){togglePanel(PANEL_KEYS[e.code]);e.preventDefault();return}
  if(G.panel)return;
  K[e.code]=true;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  const n=['Digit1','Digit2','Digit3','Digit4'].indexOf(e.code);if(n>=0){G.emote=EMOTES[n];G.emoteT=0}
});
addEventListener('keyup',e=>{K[e.code]=false});
addEventListener('blur',()=>{for(const k in K)K[k]=false});
canvas.addEventListener('mousedown',e=>{
  if(!G.started||G.panel)return;AU.init();AU.resume();
  if(e.button===0){K.MouseL=true;if(!document.pointerLockElement&&canvas.requestPointerLock)try{canvas.requestPointerLock()}catch(_){}}
  if(e.button===2)K.MouseR=true;
});
addEventListener('mouseup',e=>{if(e.button===0)K.MouseL=false;if(e.button===2)K.MouseR=false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{
  if(!G.started||G.panel)return;
  if(document.pointerLockElement===canvas||K.MouseR){cam.yaw-=e.movementX*.0035;cam.pitch=clamp(cam.pitch+e.movementY*.003,.05,1.2)}});
canvas.addEventListener('wheel',e=>{cam.dist=clamp(cam.dist+e.deltaY*.01,6,18)},{passive:true});

// ===================== BOOT =====================
function startGame(){
  AU.init();AU.resume();
  $('title').classList.add('hidden');$('hud').classList.remove('hidden');
  G.started=true;applyUI();ensureQuests();AU.vol();
  if(!S.worlds.includes(S.world))S.world=0;
  buildHero();buildWorld(S.world);rebuildPets();G.dispCoins=S.coins;
  banner(WORLDS[S.world].n.toUpperCase(),'Click to capture the mouse · whip the candy!');
  setTimeout(()=>{if(!S.stats.kills)toast('Tip: walk up to a creature and click to whip it!')},2500);
  addEventListener('beforeunload',saveGame);
}
const had=loadGame();
if(had){$('playbtn').textContent='▶ CONTINUE';$('newbtn').classList.remove('hidden')}
$('playbtn').onclick=startGame;
$('newbtn').onclick=()=>{if(confirm('Start over and erase your save?')){localStorage.removeItem(SAVE_KEY);S=DEF();startGame()}};
buildHero();buildWorld(0);G.started=false;
requestAnimationFrame(frame);
window.CWS={renderer,scene,camera,updCamera,stepGame,doHit,updWhip,updParts,S:()=>S,G,hero,cam,K,startGame,ACT,travel,startBoss,spawnEnemy,tryWhip,openPanel,closePanel,renderPanel,R,killEnemy,WHIPS,WORLDS};
