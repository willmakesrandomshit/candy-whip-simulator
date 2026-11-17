'use strict';
// ===================== STATE & SAVE =====================
const SAVE_KEY='candyWhipSim_v1';
const DEF=()=>({coins:0,gems:8,xp:0,level:1,rebirths:0,whips:[0],whip:0,world:0,worlds:[0],skin:0,skins:[0],hat:0,hats:[0],pets:{},equipped:[],stars:[],chests:{},ach:{},bossKills:{},
 stats:{kills:0,hits:0,coinsEarned:0,bosses:0,golden:0,maxCombo:0,chests:0,playtime:0,eggs:0,bestHit:0,deaths:0},quests:{date:'',list:[]},
 settings:{master:.7,music:.6,sfx:.8,shake:true,flash:true,dmgNums:true,ui:1,autoWhip:false}});
let S=DEF();
function mergeDeep(t,s){for(const k in s){if(s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])&&t[k]&&typeof t[k]==='object')mergeDeep(t[k],s[k]);else t[k]=s[k]}return t}
function loadGame(){try{const r=localStorage.getItem(SAVE_KEY);if(!r)return false;S=mergeDeep(DEF(),JSON.parse(r));return true}catch(e){console.warn('Load failed',e);S=DEF();return false}}
function saveGame(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(S))}catch(e){console.warn('Save failed',e)}}
const hasSave=()=>{try{return !!localStorage.getItem(SAVE_KEY)}catch(e){return false}};

// ===================== DERIVED STATS =====================
function petBonus(k){let v=0;for(const id of S.equipped){const p=PETS[id],lv=S.pets[id]||1;if(p&&p.b[k])v+=p.b[k]*(1+.15*(lv-1))}return v}
const rebMult=()=>1+.25*S.rebirths;
const curWhip=()=>WHIPS[S.whip];
function dmgMult(){return(1+.03*(S.level-1))*rebMult()*(1+petBonus('dmg'))}
function coinMult(){return rebMult()*(1+petBonus('coin'))*(eventActive()==='rush'?2:1)*(1+Math.min(G.combo,50)*.01)}
const luck=()=>1+petBonus('luck');
const xpNeed=l=>Math.floor(40*Math.pow(l,1.5));
const maxWorld=()=>Math.max(...S.worlds);

// ===================== EVENTS =====================
const EVENTS=[{id:'rush',n:'🍭 SUGAR RUSH — 2x coins!'},{id:'stampede',n:'✨ GOLDEN STAMPEDE — golden creatures everywhere!'},{id:'shower',n:'💎 GEM SHOWER — creatures drop gems!'}];
function eventInfo(){const t=G.time-90;if(t<0)return{active:null,left:-t};const cyc=t%300,idx=Math.floor(t/300)%3;if(cyc<60)return{active:EVENTS[idx],left:60-cyc};return{active:null,left:300-cyc,next:EVENTS[(idx+1)%3]}}
const eventActive=()=>{const e=eventInfo().active;return e?e.id:null};

// ===================== GAME RUNTIME =====================
const G={canBuy:false,hintFor:-1,started:false,panel:null,time:0,combo:0,comboT:0,shake:0,enemies:[],boss:null,colliders:[],chests:[],stars:[],cinematic:0,cinCam:null,inv:0,php:100,dispCoins:0,saveT:0,achT:0,worldGroup:null,respawns:[],emote:null,emoteT:0,prompt:'',lastHitFlash:0,pendingAltar:false,bossCool:0};
const K={};let mouseDX=0,mouseDY=0;

// ===================== THREE SETUP =====================
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(60,1,.1,400);
const hemi=new THREE.HemisphereLight(0xffffff,0x887799,.85);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,.65);sun.position.set(30,50,20);scene.add(sun);
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();

const GEO={sphere:new THREE.SphereGeometry(1,18,14),box:new THREE.BoxGeometry(1,1,1),cyl:new THREE.CylinderGeometry(1,1,1,16),cone:new THREE.ConeGeometry(1,1,16),circle:new THREE.CircleGeometry(1,40),oct:new THREE.OctahedronGeometry(1),torus:new THREE.TorusGeometry(1,.08,8,40),ring:new THREE.RingGeometry(.9,1,48)};
const M=(c,o)=>new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));
function prim(k,mat,sx,sy,sz,x,y,z){const m=new THREE.Mesh(GEO[k],mat);m.scale.set(sx,sy,sz);m.position.set(x||0,y||0,z||0);return m}

// ---- Particles (single Points object) ----
const PN=900,pPos=new Float32Array(PN*3),pCol=new Float32Array(PN*3);
const pGeo=new THREE.BufferGeometry();pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));pGeo.setAttribute('color',new THREE.BufferAttribute(pCol,3));
const spr=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d'),g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'#fff');g.addColorStop(.5,'#fffa');g.addColorStop(1,'#fff0');x.fillStyle=g;x.fillRect(0,0,32,32);return new THREE.CanvasTexture(c)})();
const pts=new THREE.Points(pGeo,new THREE.PointsMaterial({size:.7,map:spr,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));pts.frustumCulled=false;scene.add(pts);
const parts=[];const _c=new THREE.Color();
function P(x,y,z,vx,vy,vz,life,color,o){if(parts.length>=PN)parts.shift();_c.setHex(color);parts.push(Object.assign({x,y,z,vx,vy,vz,l:life,ml:life,r:_c.r,g:_c.g,b:_c.b,gr:6,home:false},o||{}))}
function burst(x,y,z,n,color,spd,life,o){for(let i=0;i<n;i++){const a=Math.random()*6.28,e=Math.random()*1.2,s=rnd(.4,1)*spd;P(x,y,z,Math.cos(a)*Math.cos(e)*s,Math.sin(e)*s+spd*.3,Math.sin(a)*Math.cos(e)*s,rnd(.5,1)*life,color,o)}}
function updParts(dt){
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.l-=dt;if(p.l<=0){parts.splice(i,1);continue}
   if(p.home){const dx=hero.pos.x-p.x,dy=hero.pos.y+1.8-p.y,dz=hero.pos.z-p.z,d=Math.hypot(dx,dy,dz)||1;const sp=Math.min(30,8+(1-p.l/p.ml)*50);p.vx=dx/d*sp;p.vy=dy/d*sp;p.vz=dz/d*sp;if(d<1)p.l=0}
   else p.vy-=p.gr*dt;
   p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<.1&&!p.home){p.y=.1;p.vy*=-.4;p.vx*=.7;p.vz*=.7}}
  for(let i=0;i<PN;i++){const p=parts[i];if(p){const f=Math.min(1,p.l/p.ml*2);pPos[i*3]=p.x;pPos[i*3+1]=p.y;pPos[i*3+2]=p.z;pCol[i*3]=p.r*f;pCol[i*3+1]=p.g*f;pCol[i*3+2]=p.b*f}else{pPos[i*3+1]=-999;pCol[i*3]=pCol[i*3+1]=pCol[i*3+2]=0}}
  pGeo.attributes.position.needsUpdate=true;pGeo.attributes.color.needsUpdate=true;
}

// ===================== HERO =====================
const hero={pos:new THREE.Vector3(0,0,8),vy:0,yaw:0,ground:true,hp:100,speed:0,walk:0,swing:-1,swingHit:false,cd:0,wb:0,land:0,idleT:0,blink:0,face:'happy',parts:{}};
hero.g=new THREE.Group();scene.add(hero.g);
function buildHero(){
  const g=hero.g;while(g.children.length)g.remove(g.children[0]);
  const sk=SKINS[S.skin];const bm=M(sk.c,{emissive:sk.em||0x303030});hero.bodyMat=bm;
  const dk=M(0xffffff);dk.color.setHex(sk.c).multiplyScalar(.9);hero.grooveMat=dk;
  const root=new THREE.Group();g.add(root);hero.root=root;
  root.add(prim('box',bm,1.7,2.6,.7,0,2.0,0));
  for(let r=0;r<3;r++)for(let c=0;c<2;c++){root.add(prim('box',dk,.74,.5,.1,(c-.5)*.8,1.15+r*.56,.38));root.add(prim('box',bm,.62,.38,.06,(c-.5)*.8,1.15+r*.56,.43))}
  root.add(prim('box',M(0xc9ced6),1.76,.3,.76,0,.88,0));root.add(prim('box',M(0xe9edf2),1.78,.08,.78,0,.98,0));
  const white=M(0xffffff),black=M(0x111111);
  hero.eyes=[];hero.brows=[];hero.pupils=[];
  for(const s of[-1,1]){const e=prim('sphere',white,.27,.32,.1,s*.38,2.85,.37);root.add(e);hero.eyes.push(e);
   const p=prim('sphere',black,.12,.14,.06,s*.38,2.83,.44);root.add(p);hero.pupils.push(p);
   const b=prim('box',M(0x3a2014),.42,.09,.07,s*.38,3.2,.38);root.add(b);hero.brows.push(b)}
  const mouth=new THREE.Mesh(new THREE.TorusGeometry(.17,.035,6,12,Math.PI),M(0x7a1a1a));mouth.position.set(0,2.62,.37);mouth.rotation.z=Math.PI;root.add(mouth);hero.mouth=mouth;
  const arm=(x)=>{const a=new THREE.Group();a.position.set(x,2.9,0);a.add(prim('box',bm,.26,.85,.26,0,-.42,0));a.add(prim('sphere',bm,.2,.2,.2,0,-.88,0));root.add(a);return a};
  hero.armL=arm(.95);hero.armR=arm(-.95);
  const leg=x=>{const l=new THREE.Group();l.position.set(x,.8,0);l.add(prim('box',bm,.32,.7,.32,0,-.35,0));l.add(prim('box',M(0x6b3f23),.4,.2,.55,0,-.7,.1));root.add(l);return l};
  hero.legL=leg(.38);hero.legR=leg(-.38);
  hero.handle=prim('cyl',M(WHIPS[S.whip].c1),.07,.55,.07,0,-.95,.2);hero.handle.rotation.x=Math.PI/2;hero.armR.add(hero.handle);
  hero.handPos=new THREE.Object3D();hero.handPos.position.set(0,-.9,.45);hero.armR.add(hero.handPos);
  const sh=new THREE.Mesh(GEO.circle,new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.28}));sh.rotation.x=-Math.PI/2;sh.scale.setScalar(.9);sh.position.y=.04;g.add(sh);hero.shadow=sh;
  // hat
  const hat=new THREE.Group();hat.position.set(0,3.3,0);root.add(hat);hero.hat=hat;
  const h=S.hat;
  if(h===1){hat.add(prim('cone',M(0xff5fa2),.45,.8,.45,0,.4,0));hat.add(prim('sphere',M(0xffd34d),.12,.12,.12,0,.85,0))}
  if(h===2){const t=new THREE.Mesh(GEO.torus,new THREE.MeshBasicMaterial({color:0xfff27a}));t.scale.setScalar(.5);t.rotation.x=Math.PI/2;t.position.y=.35;hat.add(t)}
  if(h===3){hat.add(prim('cyl',M(0xffd34d,{emissive:0x553300}),.45,.3,.45,0,.15,0));for(let i=0;i<5;i++){const a=i/5*6.28;hat.add(prim('cone',M(0xffd34d,{emissive:0x553300}),.1,.3,.1,Math.cos(a)*.4,.43,Math.sin(a)*.4))}}
  if(h===4){hat.add(prim('cone',M(0x5a3cd0),.55,1.1,.55,0,.55,0));hat.add(prim('cyl',M(0x5a3cd0),.8,.05,.8,0,.05,0))}
  if(h===5){hat.add(prim('cyl',M(0x3fe0b0),.45,.2,.45,0,.1,0));hero.prop=prim('box',M(0xff5fa2),1,.05,.12,0,.32,0);hat.add(hero.prop)}else hero.prop=null;
  hero.whipMeshes=null;buildWhipMeshes();
}
let whipSegs=[];const whipGroup=new THREE.Group();scene.add(whipGroup);
function buildWhipMeshes(){
  while(whipGroup.children.length)whipGroup.remove(whipGroup.children[0]);whipSegs=[];
  const w=curWhip(),n=Math.min(10+Math.floor(w.id/3),20);
  for(let i=0;i<n;i++){const col=w.fx==='rainbow'?new THREE.Color().setHSL(i/n,.9,.55):new THREE.Color(i%2?w.c2:w.c1);
   const glow=w.id>=8||w.fx==='gold';
   const m=glow?new THREE.MeshBasicMaterial({color:col}):M(col.getHex());
   const s=prim('sphere',m,.1+.05*(1-i/n)+w.id*.004,.1+.05*(1-i/n)+w.id*.004,.1+.05*(1-i/n)+w.id*.004);whipGroup.add(s);whipSegs.push(s)}
  const tip=prim('sphere',new THREE.MeshBasicMaterial({color:w.c2}),.22,.22,.22);whipGroup.add(tip);whipSegs.push(tip);
  if(hero.handle)hero.handle.material.color.setHex(w.c1);
}
const _v=new THREE.Vector3(),_hp=new THREE.Vector3();
function fwdV(yaw){return[Math.sin(yaw),Math.cos(yaw)]}
function whipTip(){const w=curWhip(),[fx,fz]=fwdV(hero.yaw);return{x:hero.pos.x+fx*w.reach*.98,z:hero.pos.z+fz*w.reach*.98,y:hero.pos.y+1.6}}
function updWhip(dt){
  const w=curWhip(),n=whipSegs.length-1;hero.handPos.getWorldPosition(_hp);
  const [fx,fz]=fwdV(hero.yaw),sx=fz,sz=-fx; // side vector
  const t=hero.swing<0?1:hero.swing;
  if(hero.swing>=0)hero.wb=Math.min(1,hero.wb+dt*10);else hero.wb=Math.max(0,hero.wb-dt*5);
  const tm=performance.now()/1000;
  for(let i=0;i<=n;i++){
   const s=i/n,seg=whipSegs[i];
   // idle: hangs down & sways
   const ix=_hp.x+sx*.15*s+fx*.2*s+Math.sin(tm*2+s*3)*.05,iy=_hp.y-s*1.1-.0,iz=_hp.z+sz*.15*s+fz*.2*s;
   // swing
   const p=clamp((t-.2*s)/.8,0,1),e=p*p*(3-2*p),ang=lerp(1.4,-1.4,e),r=w.reach*s;
   const cx=Math.cos(ang),sn=Math.sin(ang);
   const wx=_hp.x+(fx*cx+sx*sn)*r,wz=_hp.z+(fz*cx+sz*sn)*r,wy=_hp.y+Math.sin(s*Math.PI)*.5*(1-Math.abs(.5-p)*1.2)-.2+(1-s)*0;
   seg.position.set(lerp(ix,wx,hero.wb),lerp(iy,wy,hero.wb),lerp(iz,wz,hero.wb));
  }
  if(hero.swing>=0){const tp=whipSegs[n].position;trailFx(tp.x,tp.y,tp.z,w)}
}
function trailFx(x,y,z,w){
  const fx=w.fx;let col=w.c2;
  if(fx==='rainbow')col=new THREE.Color().setHSL((performance.now()/300)%1,1,.6).getHex();
  else if(fx==='gold')col=0xffe27a;
  if(fx==='plain'){if(Math.random()<.3)P(x,y,z,0,0,0,.2,0xffffff,{gr:0});return}
  P(x,y,z,rnd(-1,1),rnd(0,2),rnd(-1,1),.45,col,{gr:1});
  if(fx==='lightning'){P(x+rnd(-.6,.6),y+rnd(-.6,.6),z+rnd(-.6,.6),0,0,0,.15,0xffffff,{gr:0})}
  if(fx==='ice'&&Math.random()<.5)P(x,y,z,rnd(-2,2),rnd(0,3),rnd(-2,2),.6,0xffffff,{gr:3});
  if(fx==='star'||fx==='cosmic'||fx==='gold'){P(x+rnd(-.4,.4),y+rnd(-.4,.4),z+rnd(-.4,.4),0,1,0,.7,pick([w.c1,w.c2,0xffffff]),{gr:-1})}
}

// ---- hero animation ----
function animHero(dt,moving){
  const root=hero.root,t=performance.now()/1000;
  hero.g.position.copy(hero.pos);hero.g.rotation.y=hero.yaw;
  hero.shadow.scale.setScalar(clamp(.9-hero.pos.y*.05,.3,.9));
  let sx=1,sy=1;
  if(!hero.ground){sy=1.12;sx=.92}
  if(hero.land>0){hero.land-=dt*4;const l=Math.max(0,hero.land);sy=1-.25*l;sx=1+.2*l}
  const ph=hero.walk;
  const em=G.emote;
  root.rotation.y=0;root.position.y=0;
  let aL=0,aR=0,lL=0,lR=0,tilt=0,faceCur='happy';
  if(moving&&hero.ground){const sw=Math.sin(ph)*.9;lL=sw;lR=-sw;aL=-sw*.8;aR=sw*.8;root.position.y=Math.abs(Math.sin(ph))*.12;tilt=.12*(hero.speed>11?1.6:1)}
  else if(!hero.ground){aL=-2.4;aR=-2.4;lL=.4;lR=-.4}
  else{hero.idleT+=dt;aL=Math.sin(t*1.7)*.05;aR=Math.sin(t*1.7+1)*.05;sy*=1+Math.sin(t*2)*.015;
   if(hero.idleT>6){const q=(hero.idleT-6);root.rotation.y=Math.sin(q*14)*.25*Math.max(0,1-q/.8);if(q>.8)hero.idleT=0} // funny idle wiggle
  }
  if(moving)hero.idleT=0;
  if(em){G.emoteT+=dt;const e=G.emoteT;if(e>3){G.emote=null}else{
    if(em==='Dance'){root.rotation.y=Math.sin(e*10)*.4;root.position.y=Math.abs(Math.sin(e*10))*.35;aL=-2.6+Math.sin(e*10)*.5;aR=-2.6-Math.sin(e*10)*.5;lL=Math.sin(e*10)*.5;lR=-lL}
    if(em==='Wave'){aL=-2.7+Math.sin(e*12)*.4;root.rotation.y=.2}
    if(em==='Flex'){aL=-1.6;aR=-1.6;sy*=1.05;root.position.y=Math.abs(Math.sin(e*8))*.08}
    if(em==='Spin'){root.rotation.y=e*12;root.position.y=Math.max(0,Math.sin(e*3))*.7;aL=aR=-2.2}
    faceCur='joy'}}
  if(hero.swing>=0){const s=hero.swing;aR=lerp(-2.6,-.4,clamp(s*1.6,0,1));faceCur='angry'}
  if(G.inv>0.5)faceCur='ouch';
  hero.armL.rotation.x=lerp(hero.armL.rotation.x,aL,.3);hero.armR.rotation.x=lerp(hero.armR.rotation.x,aR,.5);
  hero.legL.rotation.x=lL;hero.legR.rotation.x=lR;root.rotation.x=tilt;root.scale.set(sx,sy,sx);
  // face
  const bl=(t%3.2)<.12?.1:1;for(const e of hero.eyes)e.scale.y=.32*bl;
  const br=faceCur==='angry'?.45:faceCur==='ouch'?-.4:faceCur==='joy'?-.2:0;hero.brows[0].rotation.z=br;hero.brows[1].rotation.z=-br;
  hero.mouth.rotation.z=faceCur==='angry'?0:Math.PI;hero.mouth.scale.setScalar(faceCur==='ouch'?.6:1);
  if(hero.prop)hero.prop.rotation.y=t*20;
  if(SKINS[S.skin].rainbow)hero.bodyMat.color.setHSL((t*.3)%1,.7,.8);
  if(hero.hat)hero.hat.position.y=3.3+(root.position.y);
}

// ===================== CREATURES =====================
const FACE={bar:{y:1.55,z:.52,w:.34},blob:{y:1.3,z:.8,w:.35},tall:{y:1.9,z:.7,w:.3},cone:{y:1.9,z:.45,w:.3},crab:{y:.95,z:.75,w:.4}};
function buildCreature(d,golden){
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);
  const cm=M(golden?0xffd34d:d.c,golden?{emissive:0x7a5a00}:{}),am=M(golden?0xfff2a0:d.a,golden?{emissive:0x7a6a20}:{});
  const f=FACE[d.shape];
  switch(d.shape){
   case'bar':{
    body.add(prim('box',cm,1.3,1.9,1,0,1.15,0));                       // chocolate coating
    body.add(prim('box',M(golden?0xfff2a0:0xf7e3b5),1.34,.34,1.04,0,.85,0)); // nougat layer
    body.add(prim('box',am,1.36,.3,1.06,0,1.2,0));                         // caramel layer
    for(let i=0;i<6;i++)body.add(prim('sphere',M(golden?0xffe27a:0xc89a5a),.2,.15,.24,-.5+(i%3)*.5,2.1,-.22+Math.floor(i/3)*.45)); // peanuts
    body.add(prim('box',M(golden?0xffe9a0:0x2f5fd0),1.5,.4,1.2,0,.28,0));  // wrapper skirt
    for(const s of[-1,1]){body.add(prim('box',cm,.28,.4,.28,s*.4,.2,0));const ar=prim('box',cm,.2,.7,.2,s*.8,1.1,0);ar.rotation.z=s*.3;body.add(ar)}
   }break;
   case'blob':body.add(prim('sphere',cm,.95,.9,.95,0,.9,0));break;
   case'tall':body.add(prim('cyl',cm,.7,1.1,.6,0,1.1,0));body.add(prim('sphere',cm,.7,.6,.6,0,2.1,0));body.add(prim('cyl',am,.72,.15,.62,0,.9,0));break;
   case'cone':{const c=prim('cone',cm,.75,1.5,.75,0,.75,0);c.rotation.x=Math.PI;body.add(c);body.add(prim('sphere',am,.8,.7,.8,0,1.7,0))}break;
   case'crab':body.add(prim('sphere',cm,1,.6,.85,0,.7,0));for(const s of[-1,1])for(let i=0;i<2;i++)body.add(prim('cyl',am,.08,.5,.08,s*(.7+i*.2),.3,-.1+i*.35));break;
  }
  const wh=M(0xffffff),bk=M(0x111111);
  for(const s of[-1,1]){body.add(prim('sphere',wh,f.w*.5,f.w*.55,.1,s*f.w,f.y,f.z));body.add(prim('sphere',bk,f.w*.22,f.w*.26,.06,s*f.w,f.y-.02,f.z+.07));const b=prim('box',bk,f.w*.9,.07,.06,s*f.w,f.y+f.w*.7,f.z+.03);b.rotation.z=-s*.4;body.add(b)}
  body.add(prim('box',bk,.35,.07,.05,0,f.y-.35,f.z));
  const top=d.shape==='tall'?2.7:d.shape==='cone'?2.3:d.shape==='bar'?2.3:d.shape==='blob'?1.8:1.3;
  switch(d.feat){
   case'nuts':for(let i=0;i<4;i++)body.add(prim('sphere',M(0xc89a5a),.22,.17,.22,rnd(-.45,.45),top-.05,rnd(-.3,.3)));break;
   case'helmet':body.add(prim('sphere',M(0x9aa0b4,{emissive:0x111118}),.62,.4,.62,0,top-.1,0));body.add(prim('cone',M(0xff3a3a),.1,.5,.1,0,top+.4,0));break;
   case'horns':for(const s of[-1,1]){const h=prim('cone',am,.15,.6,.15,s*.5,top,0);h.rotation.z=-s*.5;body.add(h)}break;
   case'hat':body.add(prim('cone',M(0x7affd9),.5,.7,.5,0,top+.1,0));break;
   case'antenna':for(const s of[-1,1]){body.add(prim('cyl',am,.04,.6,.04,s*.3,top+.1,0));body.add(prim('sphere',M(0xffffff,{emissive:0xaa44aa}),.12,.12,.12,s*.3,top+.45,0))}break;
   case'claws':for(const s of[-1,1])body.add(prim('sphere',am,.3,.25,.3,s*1.1,.8,.5));break;
   case'spikes':for(let i=0;i<6;i++){const a=i/6*6.28;body.add(prim('cone',am,.12,.4,.12,Math.cos(a)*.5,top-.2,Math.sin(a)*.5-.1))}break;
   case'crown':body.add(prim('cyl',M(0xffd34d,{emissive:0x664400}),.5,.25,.5,0,top+.05,0));for(let i=0;i<5;i++){const a=i/5*6.28;body.add(prim('cone',M(0xffd34d,{emissive:0x664400}),.1,.3,.1,Math.cos(a)*.45,top+.3,Math.sin(a)*.45))}break;
  }
  g.add(prim('circle',new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.25}),1.1,1.1,1.1,0,.04,0)).rotation.x=-Math.PI/2;
  g.scale.setScalar(d.s);
  return{g,body,cm,am,base:golden?0x7a5a00:0};
}
function spawnEnemy(k,golden,x,z){
  const W=WORLDS[k];let tot=0;for(const e of W.enemies)tot+=e.w;let r=Math.random()*tot,d=W.enemies[0];for(const e of W.enemies){if(r<e.w){d=e;break}r-=e.w}
  const c=buildCreature(d,golden);
  if(x===undefined){let tries=0;do{const a=Math.random()*6.28,rr=rnd(17,62);x=Math.cos(a)*rr;z=Math.sin(a)*rr;tries++}while(tries<20&&(Math.hypot(x-hero.pos.x,z-hero.pos.z)<10||Math.hypot(x,z+38)<12))}
  c.g.position.set(x,0,z);scene.add(c.g);
  const hp=3*wBase(k)*d.hp*(golden?6:1),coin=8*wBase(k)*d.coin*(golden?10:1);
  const e=Object.assign(c,{d,k,golden,hp,maxhp:hp,coin,x,z,home:{x,z},tx:x,tz:z,wait:rnd(0,3),stun:0,vx:0,vz:0,sq:0,fl:0,r:1.0*d.s,alive:true,t:rnd(0,9),spawnT:0,isBoss:false,speed:rnd(1.5,2.5)});
  c.g.scale.setScalar(.01);
  G.enemies.push(e);return e;
}
function removeEnemy(e){scene.remove(e.g);const i=G.enemies.indexOf(e);if(i>=0)G.enemies.splice(i,1)}
function goldenChance(){const ev=eventActive()==='stampede'?.35:0;return .04*luck()+ev}
function fillEnemies(){const want=18;while(G.enemies.filter(e=>!e.isBoss&&!e.minion).length+G.respawns.length<want)spawnEnemy(S.world,Math.random()<goldenChance())}
function updEnemies(dt){
  for(const e of G.enemies){
    if(!e.alive)continue;e.t+=dt;
    if(e.spawnT<1){e.spawnT=Math.min(1,e.spawnT+dt*3);const s=e.d.s*(e.isBoss?1:1)*(e.spawnT*e.spawnT*(3-2*e.spawnT));e.g.scale.setScalar(Math.max(.01,s))}
    if(e.isBoss)continue;
    if(e.stun>0){e.stun-=dt;e.x+=e.vx*dt;e.z+=e.vz*dt;e.vx*=.9;e.vz*=.9}
    else{
      e.wait-=dt;
      if(e.wait<=0&&Math.hypot(e.tx-e.x,e.tz-e.z)<.5){e.tx=e.home.x+rnd(-9,9);e.tz=e.home.z+rnd(-9,9);e.wait=rnd(1,4)}
      const dx=e.tx-e.x,dz=e.tz-e.z,d=Math.hypot(dx,dz);
      if(d>.5&&e.wait<=0||d>.5){const sp=e.speed*(e.golden?2.2:1);e.x+=dx/d*sp*dt;e.z+=dz/d*sp*dt;e.g.rotation.y=Math.atan2(dx,dz);e.body.position.y=Math.abs(Math.sin(e.t*7))*.35*e.d.s}
      else e.body.position.y*=.8;
      if(e.golden&&Math.random()<dt*4)P(e.x+rnd(-.8,.8),rnd(.5,2.5),e.z+rnd(-.8,.8),0,1.5,0,.7,0xffe27a,{gr:-1});
    }
    const r=Math.hypot(e.x,e.z);if(r>66){e.x*=66/r;e.z*=66/r}
    e.g.position.x=e.x;e.g.position.z=e.z;
    if(e.sq>0){e.sq=Math.max(0,e.sq-dt*5);e.body.scale.set(1+e.sq*.35,1-e.sq*.4,1+e.sq*.35)}else e.body.scale.set(1,1,1);
    if(e.fl>0){e.fl-=dt;const on=e.fl>0;e.cm.emissive.setHex(on?0xffffff:e.base);e.am.emissive.setHex(on?0xffffff:e.base)}
  }
  for(let i=G.respawns.length-1;i>=0;i--){G.respawns[i]-=dt;if(G.respawns[i]<=0){G.respawns.splice(i,1);spawnEnemy(S.world,Math.random()<goldenChance())}}
}

// ===================== COMBAT =====================
function damageTarget(e,dmg,crit,dirx,dirz){
  e.hp-=dmg;e.sq=1;e.fl=.12;S.stats.hits++;if(dmg>S.stats.bestHit)S.stats.bestHit=dmg;
  if(!e.isBoss){e.stun=.45;const l=Math.hypot(dirx,dirz)||1;e.vx=dirx/l*(crit?9:6);e.vz=dirz/l*(crit?9:6);e.wait=0;e.tx=e.home.x+rnd(-9,9);e.tz=e.home.z+rnd(-9,9)}
  burst(e.g.position.x,1.2*e.d.s,e.g.position.z,crit?16:9,crit?0xffa040:0xfff0a0,6,.6);
  burst(e.g.position.x,1.2*e.d.s,e.g.position.z,4,e.d.c,4,.5);
  if(S.settings.dmgNums)ftext(e.g.position.x,2.4*e.d.s,e.g.position.z,(crit?'CRIT! ':'')+fmt(dmg),crit?'crit':'');
  AU.hit(crit||e.isBoss);
  G.combo++;G.comboT=2.2;if(G.combo>S.stats.maxCombo)S.stats.maxCombo=G.combo;qEvent('combo',G.combo);
  G.shake=Math.max(G.shake,Math.min(.35,.06+curWhip().id*.008)*(crit?1.5:1));
  if(e.hp<=0)killEnemy(e);
}
function killEnemy(e){
  e.alive=false;S.stats.kills++;
  const coins=e.coin*coinMult();
  gainCoins(coins,e.g.position.x,e.g.position.z);
  const xp=4+Math.sqrt(e.coin)*(e.isBoss?8:1.2);gainXP(xp);
  burst(e.g.position.x,1.5,e.g.position.z,24,e.golden?0xffd34d:e.d.c,9,.9);
  const n=clamp(Math.floor(Math.log10(coins+1)*2)+3,3,14);for(let i=0;i<n;i++)P(e.g.position.x,1.2,e.g.position.z,rnd(-4,4),rnd(4,9),rnd(-4,4),1.2,0xffd34d,{home:true,gr:12,l:1.2});
  const dropGem=(e.golden&&Math.random()<.6)||eventActive()==='shower'&&Math.random()<.25||Math.random()<.01*luck();
  if(dropGem)gainGems(1,'Gem drop!');
  if(e.golden){S.stats.golden++;qEvent('golden',1)}
  qEvent('kill',1);
  if(e.isBoss){bossDefeated(e);return}
  // pop & respawn
  const g=e.g;let k=0;const iv=setInterval(()=>{k++;g.scale.multiplyScalar(.7);if(k>5){clearInterval(iv)}},30);
  setTimeout(()=>scene.remove(g),200);
  const i=G.enemies.indexOf(e);if(i>=0)G.enemies.splice(i,1);
  if(!e.minion)G.respawns.push(rnd(5,9));
}
function gainCoins(n,x,z){S.coins+=n;S.stats.coinsEarned+=n;qEvent('coins',n);AU.coin(G.combo);if(x!==undefined)ftext(x,3.2,z,'+'+fmt(n),'coin');$('coins').classList.remove('pulse');void $('coins').offsetWidth;$('coins').classList.add('pulse')}
function gainGems(n,msg){S.gems+=n;toast('💎 +'+n+(msg?' '+msg:''))}
function gainXP(x){S.xp+=x;let up=false;while(S.level<100&&S.xp>=xpNeed(S.level)){S.xp-=xpNeed(S.level);S.level++;up=true;if(S.level%5===0)gainGems(2,'Level bonus')}
  if(up){AU.up();banner('LEVEL '+S.level+'!','+3% damage per level');burst(hero.pos.x,2,hero.pos.z,40,0xffd34d,10,1.2);G.emote='Dance';G.emoteT=0}}
function nearestEnemy(range){let best=null,bd=range;for(const e of G.enemies){if(!e.alive)continue;const d=Math.hypot(e.g.position.x-hero.pos.x,e.g.position.z-hero.pos.z)-e.r;if(d<bd){bd=d;best=e}}return best}
function tryWhip(){
  if(hero.cd>0||hero.swing>=0||G.cinematic>0||G.panel||!G.started)return;
  const w=curWhip(),t=nearestEnemy(w.reach+2);
  if(t)hero.yaw=Math.atan2(t.g.position.x-hero.pos.x,t.g.position.z-hero.pos.z);
  else if(hero.speed<.5){const[fx,fz]=camFwd();hero.yaw=Math.atan2(fx,fz)}
  hero.swing=0;hero.swingHit=false;hero.cd=w.cd;G.emote=null;AU.whip(w.id);
}
function updSwing(dt){
  hero.cd-=dt;
  if(hero.swing<0)return;
  const w=curWhip();hero.swing+=dt/(w.cd*.85+.08);
  if(hero.swing>=.5&&!hero.swingHit){hero.swingHit=true;doHit(w)}
  if(hero.swing>=1){hero.swing=-1}
}
function doHit(w){
  const[fx,fz]=fwdV(hero.yaw);let hit=0;const tip=whipTip();
  burst(tip.x,tip.y,tip.z,10,w.c2,5,.4);
  for(const e of G.enemies.slice()){
    if(!e.alive)continue;const dx=e.g.position.x-hero.pos.x,dz=e.g.position.z-hero.pos.z,d=Math.hypot(dx,dz);
    if(d>w.reach+e.r)continue;if((dx*fx+dz*fz)/(d||1)<.12&&d>e.r+1.2)continue;
    const crit=Math.random()<.08;let dmg=Math.max(1,Math.round(w.power*dmgMult()*(crit?2:1)));
    damageTarget(e,dmg,crit,dx,dz);hit++;
  }
  if(hit>1)ftext(hero.pos.x,3.6,hero.pos.z,hit+'x MULTI-HIT!','sys');
}

// ===================== BOSS =====================
function startBoss(){
  if(G.boss||G.bossCool>0||G.cinematic>0)return;
  const k=S.world,bd=WORLDS[k].boss;
  const d={n:bd.n,shape:bd.shape,c:bd.c,a:bd.a,feat:bd.feat,s:4.6};
  const b=spawnEnemy(k,false,0,-52);G.enemies.splice(G.enemies.indexOf(b),1);scene.remove(b.g); // discard random one
  const c=buildCreature(d,false);c.g.position.set(0,0,-52);scene.add(c.g);
  const hp=3*wBase(k)*bd.hp,coin=8*wBase(k)*bd.coin;
  const e=Object.assign(c,{d,k,golden:false,hp,maxhp:hp,coin,x:0,z:-52,home:{x:0,z:-52},stun:0,vx:0,vz:0,sq:0,fl:0,r:3.2*1.1,alive:true,t:0,spawnT:0,isBoss:true,boss:bd});
  c.g.scale.setScalar(.01);G.enemies.push(e);
  G.boss={e,state:'intro',t:0,phase:1,cool:1.5,tele:null,dir:[0,1],hitDone:false,wave:0};
  // clear regular enemies near? keep. cinematic
  G.cinematic=3.2;G.cinCam={x:0,z:-52};G.php=hero.hp=100;AU.roar();AU.setBoss(true);
  document.querySelectorAll('.bars').forEach(b=>b.classList.add('on'));
  banner(bd.n.toUpperCase(),'World Boss — dodge the red zones!');
  $('bossbar').classList.remove('hidden');$('bossname').textContent=bd.n;$('php').classList.remove('hidden');
  hero.hp=100;
}
function makeTele(kind,x,z,r,len,dir){
  const g=new THREE.Group();
  if(kind==='circle'){const m=prim('circle',new THREE.MeshBasicMaterial({color:0xff2a2a,transparent:true,opacity:.35,depthWrite:false}),r,r,r,x,.08,z);m.rotation.x=-Math.PI/2;g.add(m);const o=prim('ring',new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9}),r,r,r,x,.1,z);o.rotation.x=-Math.PI/2;g.add(o)}
  else{const m=prim('box',new THREE.MeshBasicMaterial({color:0xff2a2a,transparent:true,opacity:.35,depthWrite:false}),r*2,.05,len,0,0,len/2);g.add(m);g.position.set(x,.1,z);g.rotation.y=Math.atan2(dir[0],dir[1])}
  scene.add(g);return g;
}
function clearTele(){const b=G.boss;if(b&&b.tele){scene.remove(b.tele.g);b.tele=null}}
function hurtHero(n){
  if(G.inv>0||G.cinematic>0)return;hero.hp-=n;G.inv=1.2;G.shake=.5;AU.err();burst(hero.pos.x,1.5,hero.pos.z,14,0xff4060,6,.6);
  if(S.settings.flash){const f=$('flash');f.style.opacity=.35;setTimeout(()=>f.style.opacity=0,120)}
  const a=Math.atan2(hero.pos.x-(G.boss?G.boss.e.x:0),hero.pos.z-(G.boss?G.boss.e.z:0));hero.pos.x+=Math.sin(a)*2;hero.pos.z+=Math.cos(a)*2;hero.vy=6;hero.ground=false;
  if(hero.hp<=0)heroDown();
}
function heroDown(){
  S.stats.deaths++;banner('SUGAR CRASH!','The boss recovered. Try again!');
  endBoss(false);hero.hp=100;hero.pos.set(0,0,8);hero.vy=0;G.combo=0;
}
function endBoss(won){
  const b=G.boss;if(!b)return;clearTele();
  if(!won){removeEnemy(b.e);for(const e of G.enemies.filter(x=>x.minion))removeEnemy(e)}
  G.boss=null;G.cinematic=0;AU.setBoss(false);G.bossCool=won?25:6;
  $('bossbar').classList.add('hidden');$('php').classList.add('hidden');document.querySelectorAll('.bars').forEach(b=>b.classList.remove('on'));
}
function bossDefeated(e){
  const bd=e.boss,k=e.k;S.stats.bosses++;const first=!S.bossKills[k];S.bossKills[k]=(S.bossKills[k]||0)+1;
  gainGems(bd.gems+(first?10:0),first?'First-kill bonus!':'');qEvent('boss',1);
  if(first&&k<HATS.length-1&&!S.hats.includes(k+1)){S.hats.push(k+1);toast('🎩 Unlocked hat: '+HATS[k+1].n+'!')}
  banner('BOSS DEFEATED!',bd.n+' fell for '+fmt(e.coin*coinMult())+' coins');
  AU.up();AU.boom();for(let i=0;i<5;i++)burst(e.g.position.x+rnd(-3,3),rnd(1,6),e.g.position.z+rnd(-3,3),30,pick([0xffd34d,0xff5fa2,0x7affd9,0xffffff]),12,1.4);
  for(let i=0;i<30;i++)P(e.g.position.x,3,e.g.position.z,rnd(-8,8),rnd(6,14),rnd(-8,8),1.5,0xffd34d,{home:true,l:1.5,gr:14});
  G.emote='Dance';G.emoteT=0;
  const g=e.g;setTimeout(()=>scene.remove(g),150);
  const i=G.enemies.indexOf(e);if(i>=0)G.enemies.splice(i,1);
  for(const m of G.enemies.filter(x=>x.minion).slice())removeEnemy(m);
  endBoss(true);
}
function updBoss(dt){
  const b=G.boss;if(!b)return;const e=b.e;
  $('bossfill').style.width=Math.max(0,e.hp/e.maxhp*100)+'%';$('phpf').style.width=Math.max(0,hero.hp)+'%';
  if(b.state==='intro'){
    G.cinematic-=dt;e.g.rotation.y+=dt*.6;e.g.position.z=e.z;
    if(G.cinematic<=0){G.cinematic=0;b.state='idle';document.querySelectorAll('.bars').forEach(x=>x.classList.remove('on'))}
    return;
  }
  e.t+=dt;e.g.position.x=e.x;e.g.position.z=e.z;
  if(e.fl>0){e.fl-=dt;const on=e.fl>0;e.cm.emissive.setHex(on?0xffffff:0);e.am.emissive.setHex(on?0xffffff:0)}
  if(e.sq>0){e.sq=Math.max(0,e.sq-dt*4);e.body.scale.set(1+e.sq*.12,1-e.sq*.15,1+e.sq*.12)}
  const pdx=hero.pos.x-e.x,pdz=hero.pos.z-e.z,pd=Math.hypot(pdx,pdz);
  if(b.phase===1&&e.hp<e.maxhp*.5){b.phase=2;banner('PHASE 2!','The boss is furious!');AU.roar();G.shake=.6;for(let i=0;i<3;i++){const m=spawnEnemy(e.k,false,e.x+rnd(-8,8),e.z+rnd(4,12));m.minion=true}}
  const ph2=b.phase===2,spd=ph2?4.5:3;
  b.t+=dt;
  if(b.state==='idle'){
    e.g.rotation.y=Math.atan2(pdx,pdz);e.body.position.y=Math.abs(Math.sin(e.t*3))*.4;
    if(pd>e.r+3){e.x+=pdx/pd*spd*dt;e.z+=pdz/pd*spd*dt}
    b.cool-=dt;
    if(b.cool<=0){const r=Math.random();
      if(ph2&&r<.3){b.state='wave';b.t=0;b.wave=0;AU.tele();ftext(e.x,8,e.z,'JUMP!','crit')}
      else if(r<.65){b.state='slam';b.t=0;b.tp={x:hero.pos.x,z:hero.pos.z};b.tele={g:makeTele('circle',b.tp.x,b.tp.z,6,0)};AU.tele()}
      else{b.state='charge';b.t=0;b.dir=[pdx/pd,pdz/pd];b.tele={g:makeTele('line',e.x,e.z,2.6,60,b.dir)};e.g.rotation.y=Math.atan2(b.dir[0],b.dir[1]);AU.tele()}}
  }else if(b.state==='slam'){
    const dur=ph2?.9:1.2;if(b.tele)b.tele.g.children[0].material.opacity=.25+.3*Math.abs(Math.sin(b.t*10));
    e.body.position.y=Math.min(3,b.t*4);
    if(b.t>=dur){clearTele();e.body.position.y=0;G.shake=.7;AU.boom();burst(b.tp.x,.5,b.tp.z,50,0xffa040,12,.8);
      e.x=b.tp.x-Math.sign(b.tp.x-e.x)*0;e.z=e.z; // boss stays; slam lands at target
      if(Math.hypot(hero.pos.x-b.tp.x,hero.pos.z-b.tp.z)<6)hurtHero(30);
      b.state='recover';b.t=0}
  }else if(b.state==='charge'){
    if(b.tele)b.tele.g.children[0].material.opacity=.25+.3*Math.abs(Math.sin(b.t*12));
    if(b.t>=(ph2?.8:1.1)){clearTele();b.state='charging';b.t=0;b.hitDone=false;AU.roar()}
  }else if(b.state==='charging'){
    e.x+=b.dir[0]*34*dt;e.z+=b.dir[1]*34*dt;e.body.position.y=0;
    P(e.x,.5,e.z,rnd(-2,2),rnd(1,4),rnd(-2,2),.5,0xffa040,{});
    const r=Math.hypot(e.x,e.z);if(r>64){e.x*=64/r;e.z*=64/r;b.t=9}
    if(!b.hitDone&&Math.hypot(hero.pos.x-e.x,hero.pos.z-e.z)<e.r+1.3&&hero.pos.y<2){b.hitDone=true;hurtHero(25)}
    if(b.t>1.4){b.state='recover';b.t=0;G.shake=.4}
  }else if(b.state==='wave'){
    if(b.t<.9){e.body.position.y=Math.min(2.5,b.t*4)}
    else{if(!b.ring){b.ring=prim('ring',new THREE.MeshBasicMaterial({color:0xffe14a,side:THREE.DoubleSide,transparent:true,opacity:.8}),1,1,1,e.x,.4,e.z);b.ring.rotation.x=-Math.PI/2;scene.add(b.ring);b.wave=2;G.shake=.7;AU.boom();e.body.position.y=0}
      b.wave+=dt*16;b.ring.scale.set(b.wave,b.wave,b.wave);b.ring.material.opacity=Math.max(.1,1-b.wave/34);
      const d=Math.hypot(hero.pos.x-e.x,hero.pos.z-e.z);if(Math.abs(d-b.wave)<1.4&&hero.pos.y<.9)hurtHero(20);
      if(b.wave>36){scene.remove(b.ring);b.ring=null;b.state='recover';b.t=0}}
  }else if(b.state==='recover'){
    e.body.position.y=0;if(b.t>(ph2?.8:1.3)){b.state='idle';b.cool=ph2?.9:1.6}
  }
  e.g.position.x=e.x;e.g.position.z=e.z;
}

// ===================== PICKUPS, CHESTS, STARS =====================
function updPickups(dt){
  const t=G.time;
  for(const c of G.chests){
    const opened=c.open||(S.chests[S.world+':'+c.i]&&Date.now()-S.chests[S.world+':'+c.i]<300000);
    c.g.visible=!opened;if(opened)continue;
    c.g.rotation.y=Math.sin(t*2+c.i)*.15;c.lid.rotation.x=-.1+Math.sin(t*4)*.05;
    if(Math.hypot(hero.pos.x-c.x,hero.pos.z-c.z)<2.6){S.chests[S.world+':'+c.i]=Date.now();c.open=false;c.g.visible=false;
      const k=S.world;const coins=8*wBase(k)*25*coinMult();gainCoins(coins,c.x,c.z);if(Math.random()<.5||k>=3)gainGems(1+Math.floor(Math.random()*3),'from chest');
      S.stats.chests++;qEvent('chest',1);AU.up();burst(c.x,1.5,c.z,40,0xffd34d,10,1);toast('🎁 Treasure chest! +'+fmt(coins)+' coins');}
  }
  for(const s of G.stars){
    const key=S.world+':'+s.i;if(S.stars.includes(key)){s.g.visible=false;continue}
    s.g.rotation.y=t*2;s.g.position.y=1.6+Math.sin(t*3+s.i)*.3;if(Math.random()<dt*3)P(s.x+rnd(-.5,.5),s.g.position.y,s.z+rnd(-.5,.5),0,1,0,.8,0xfff27a,{gr:-1});
    if(Math.hypot(hero.pos.x-s.x,hero.pos.z-s.z)<2.2&&Math.abs(hero.pos.y+1-s.g.position.y)<3){S.stars.push(key);s.g.visible=false;gainGems(2,'Sugar Star '+S.stars.length+'/30');AU.up();burst(s.x,1.6,s.z,30,0xfff27a,9,1);
      if(S.stars.length>=30&&!S.whips.includes(30)){S.whips.push(30);toast('🌟 SECRET WHIP UNLOCKED: The Golden Wrapper!');banner('SECRET UNLOCKED!','The Golden Wrapper whip')}}
  }
}

// ===================== QUESTS =====================
const QT=[
 {id:'kill',txt:n=>'Defeat '+n+' candy creatures',rng:[15,40],ev:'kill',gem:3},{id:'coins',txt:n=>'Earn '+fmt(n)+' coins',scaled:true,ev:'coins',gem:3},
 {id:'combo',txt:n=>'Reach a x'+n+' combo',rng:[8,20],ev:'combo',max:true,gem:2},{id:'boss',txt:()=>'Defeat a world boss',n:1,ev:'boss',gem:6},
 {id:'chest',txt:n=>'Open '+n+' treasure chests',rng:[2,4],ev:'chest',gem:3},{id:'golden',txt:()=>'Defeat a golden creature',n:1,ev:'golden',gem:5},{id:'egg',txt:()=>'Hatch a pet egg',n:1,ev:'egg',gem:2}];
function ensureQuests(){
  const d=new Date().toDateString();if(S.quests.date===d&&S.quests.list.length)return;
  const r=rngSeed(Array.from(d).reduce((a,c)=>a*31+c.charCodeAt(0)|0,7));const pool=QT.slice();const list=[];
  while(list.length<3){const q=pool.splice(Math.floor(r()*pool.length),1)[0];const mw=maxWorld();
   const n=q.scaled?Math.round(8*wBase(mw)*40):q.n||Math.round(q.rng[0]+r()*(q.rng[1]-q.rng[0]));
   list.push({id:q.id,n,p:0,done:false,claimed:false,gem:q.gem,coins:Math.round(8*wBase(mw)*25)})}
  S.quests={date:d,list};
}
function qEvent(ev,v){const def=QT;for(const q of S.quests.list){const t=def.find(x=>x.id===q.id);if(!t||t.ev!==ev||q.done)continue;if(t.max)q.p=Math.max(q.p,v);else q.p+=v;if(q.p>=q.n){q.p=q.n;q.done=true;toast('✅ Quest complete: '+t.txt(q.n))}}}

// ===================== WORLD BUILDING =====================
function disposeGroup(g){g.traverse(o=>{if(o.geometry&&!Object.values(GEO).includes(o.geometry))o.geometry.dispose();if(o.material&&!o.isInstancedMesh)o.material.dispose&&0})}
function scatter(g,geo,mat,count,minR,maxR,sMin,sMax,r,yoff,collide){
  const im=new THREE.InstancedMesh(geo,mat,count),m=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3();
  for(let i=0;i<count;i++){const a=r()*6.28,rr=minR+r()*(maxR-minR),sc=sMin+r()*(sMax-sMin);p.set(Math.cos(a)*rr,yoff*sc,Math.sin(a)*rr);s.set(sc,sc,sc);q.setFromAxisAngle(new THREE.Vector3(0,1,0),r()*6.28);m.compose(p,q,s);im.setMatrixAt(i,m)}
  g.add(im);return im}
function treeAt(g,x,z,k,r){
  const s=.8+r()*.8;const t=new THREE.Group();t.position.set(x,0,z);
  if(k===0){t.add(prim('cyl',M(0xc88a5a),.25*s,1.8*s,.25*s,0,.9*s,0));const cs=[0xff9ec8,0xffc0e0,0xbfe9ff];for(let i=0;i<4;i++)t.add(prim('sphere',M(cs[i%3]),1.1*s,1*s,1.1*s,Math.cos(i*1.6)*.7*s,(2.3+i*.15)*s,Math.sin(i*1.6)*.7*s));t.add(prim('sphere',M(0xffffff),1.1*s,1*s,1.1*s,0,3.1*s,0))}
  if(k===1){t.add(prim('cyl',M(0xb3701c),.9*s,2.2*s,.9*s,0,1.1*s,0));t.add(prim('cyl',M(0xffc94a,{emissive:0x553300}),1.2*s,.3*s,1.2*s,0,2.3*s,0))}
  if(k===2){t.add(prim('cyl',M(0xf4e4c8),.2*s,2*s,.2*s,0,s,0));t.add(prim('sphere',M(0x4a2a18),1.2*s,1.2*s,1.2*s,0,2.6*s,0));t.add(prim('torus',M(0xff5fa2),1.2*s,1.2*s,1.2*s,0,2.6*s,0));}
  if(k===3){const c=prim('cone',M(0xe0b070),.9*s,2.2*s,.9*s,0,1.1*s,0);c.rotation.x=Math.PI;t.add(c);t.add(prim('sphere',M(pick([0xffb8e0,0xb8fff0,0xffffff,0xffe9a0])),1.1*s,1*s,1.1*s,0,2.6*s,0))}
  if(k===4){t.add(prim('oct',new THREE.MeshLambertMaterial({color:pick([0x40ffe0,0xff40c0,0xffee66]),emissive:0x221144}),.7*s,1.6*s,.7*s,0,1.6*s,0))}
  g.add(t);G.colliders.push({x,z,r:.8*s+.2});return t}
function buildWorld(k){
  if(G.worldGroup){scene.remove(G.worldGroup);disposeGroup(G.worldGroup)}
  for(const e of G.enemies.slice())removeEnemy(e);G.respawns=[];G.colliders=[];G.chests=[];G.stars=[];
  if(G.boss)endBoss(false);
  const W=WORLDS[k],g=new THREE.Group();G.worldGroup=g;scene.add(g);const r=rngSeed(1000+k*77);
  scene.background=new THREE.Color(W.sky);scene.fog=new THREE.Fog(W.fog,50,150);
  hemi.color.setHex(k===4?0x9080ff:k===2?0xd8b8a8:0xffffff);hemi.intensity=k===4?.8:.85;
  g.add(prim('circle',M(W.ground),78,78,78,0,0,0)).rotation.x=-Math.PI/2;
  for(let i=0;i<40;i++){const p=prim('circle',M(W.patch),rnd(3,8),1,rnd(3,8),rnd(-60,60),.02,rnd(-60,60));p.rotation.x=-Math.PI/2;p.scale.z=p.scale.x;g.add(p)}
  // ring edge
  const edge=new THREE.Mesh(GEO.torus,new THREE.MeshBasicMaterial({color:k===4?0xff40c0:W.patch}));edge.scale.setScalar(78);edge.rotation.x=Math.PI/2;edge.position.y=.1;g.add(edge);
  // trees
  const nt=k===4?30:42;for(let i=0;i<nt;i++){const a=r()*6.28,rr=16+r()*52;if(Math.hypot(Math.cos(a)*rr,Math.sin(a)*rr+38)<9)continue;treeAt(g,Math.cos(a)*rr,Math.sin(a)*rr,k,r)}
  const tuft=k===4?0x40ffe0:k===0?0xff7ab8:k===1?0xc47a1e:k===2?0x8a5a3a:0xbfe0ff;
  scatter(g,GEO.cone,M(tuft),320,6,74,.3,.7,r,.4);
  // altar
  const al=new THREE.Group();al.position.set(0,0,-38);al.add(prim('cyl',M(0x3a2a5a),4,.4,4,0,.2,0));const tor=new THREE.Mesh(GEO.torus,new THREE.MeshBasicMaterial({color:0xff4a6a}));tor.scale.setScalar(3.5);tor.rotation.x=Math.PI/2;tor.position.y=.6;al.add(tor);
  al.add(prim('cyl',new THREE.MeshBasicMaterial({color:0xff4a6a,transparent:true,opacity:.2,depthWrite:false}),3,12,3,0,6,0));al.add(prim('cone',M(0xffd34d,{emissive:0x664400}),.8,2,.8,0,1.6,0));g.add(al);G.altar=al;G.colliders.push({x:0,z:-38,r:1});
  // world specific scenery
  if(k===0){// village
    for(let i=0;i<6;i++){const a=i/6*6.28+.3,x=Math.cos(a)*11,z=Math.sin(a)*11+0;const h=new THREE.Group();h.position.set(x,0,z);h.rotation.y=-a+Math.PI/2;
      h.add(prim('box',M(pick([0xffd1e6,0xcdeeff,0xfff3b0,0xd7ffd0])),3.4,2.4,3.4,0,1.2,0));h.add(prim('cone',M(pick([0xff4a8a,0x8a6aff,0xff9a3a])),2.9,1.8,2.9,0,3.3,0)).rotation.y=Math.PI/4;
      h.add(prim('box',M(0x8a5a3a),.8,1.4,.1,0,.7,1.72));h.add(prim('cyl',M(0xff4a8a),.12,1.2,.12,1.8,.6,1.8));g.add(h);G.colliders.push({x,z,r:2.2})}
    const f=new THREE.Group();f.position.set(0,0,0);f.add(prim('cyl',M(0xffffff),2.2,.6,2.2,0,.3,0));f.add(prim('cyl',M(0x9ee0ff),1.8,.65,1.8,0,.32,0));f.add(prim('cyl',M(0xffffff),.35,1.8,.35,0,1.2,0));f.add(prim('sphere',M(0xff9ec8),.7,.5,.7,0,2.2,0));g.add(f);G.colliders.push({x:0,z:0,r:2.3});
    for(let i=0;i<8;i++){const a=r()*6.28,rr=20+r()*40;const p=new THREE.Group();p.position.set(Math.cos(a)*rr,0,Math.sin(a)*rr);p.add(prim('cyl',M(0xffffff),.08,2.2,.08,0,1.1,0));p.add(prim('sphere',M(pick([0xff4a8a,0x6ad0ff,0xffe14a])),.6,.6,.2,0,2.4,0));g.add(p)}
    for(let i=0;i<10;i++){const c=prim('sphere',new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:.85}),rnd(4,9),rnd(2,3),rnd(3,6),rnd(-80,80),rnd(28,45),rnd(-90,-20));g.add(c)}
  }
  if(k===1){
    for(let i=0;i<30;i++){const a=i/30*6.28,rr=80+r()*8,h=rnd(14,32);const c=prim('box',M(pick([0xc9822b,0xb3701c,0xe0a040])),rnd(8,14),h,rnd(8,14),Math.cos(a)*rr,h/2,Math.sin(a)*rr);c.rotation.y=r()*3;g.add(c)}
    for(let i=0;i<46;i++){const z=-70+i*3.1,x=Math.sin(z*.09)*18+10;const rv=prim('box',new THREE.MeshLambertMaterial({color:0xa85a12,emissive:0x5a2a00}),9,.12,3.4,x,.06,z);rv.rotation.y=Math.cos(z*.09)*.5;g.add(rv)}
    for(let i=0;i<16;i++){const a=r()*6.28,rr=20+r()*45,s=1+r()*2;const x=Math.cos(a)*rr,z=Math.sin(a)*rr;g.add(prim('cone',M(0xffc94a,{emissive:0x442200}),s,s*4,s,x,s*2,z));G.colliders.push({x,z,r:s*.8})}
  }
  if(k===2){
    const cx=0,cz=-70;g.add(prim('box',M(0x4a2a18),50,14,8,cx,7,cz));for(const dx of[-26,26,-12,12]){g.add(prim('cyl',M(0x5a3320),5,26,5,dx,13,cz+2));g.add(prim('cone',M(0xff5fa2),6,8,6,dx,30,cz+2))}
    g.add(prim('box',M(0x2a1208),8,9,1,cx,4.5,cz+4.1));
    for(let i=0;i<24;i++){const a=i/24*6.28,x=Math.cos(a)*72,z=Math.sin(a)*72;g.add(prim('box',M(0x5a3320),9,rnd(8,14),4,x,6,z)).rotation.y=-a}
    for(let i=0;i<10;i++){const p=prim('circle',new THREE.MeshLambertMaterial({color:0x2a1208,emissive:0x1a0800}),rnd(3,6),1,rnd(3,6),rnd(-55,55),.05,rnd(-30,55));p.rotation.x=-Math.PI/2;g.add(p)}
  }
  if(k===3){
    for(let i=0;i<22;i++){const a=i/22*6.28,rr=82+r()*8,h=rnd(18,36);g.add(prim('cone',M(pick([0xffffff,0xffd1e6,0xcfeaff,0xd7fff0])),rnd(10,16),h,rnd(10,16),Math.cos(a)*rr,h/2,Math.sin(a)*rr));g.add(prim('sphere',M(0xff9ec8),7,5,7,Math.cos(a)*rr,h+1,Math.sin(a)*rr))}
    const lake=prim('circle',new THREE.MeshPhongMaterial({color:0x8ad8ff,shininess:100,specular:0xffffff}),14,1,14,-28,.06,22);lake.rotation.x=-Math.PI/2;g.add(lake);
  }
  if(k===4){
    const st=new Float32Array(900);for(let i=0;i<300;i++){const a=r()*6.28,e=r()*1.5-.2,d=170;st[i*3]=Math.cos(a)*Math.cos(e)*d;st[i*3+1]=Math.sin(e)*d+30;st[i*3+2]=Math.sin(a)*Math.cos(e)*d}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(st,3));g.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:2,sizeAttenuation:false,fog:false})));
    const cols=[0xff40c0,0x40ffe0,0xffee66,0x9b5cff,0xff8a40];
    for(let i=0;i<14;i++){const a=r()*6.28,rr=85+r()*60,s=rnd(5,16),y=rnd(-10,50);const c=cols[i%5];g.add(prim('sphere',new THREE.MeshLambertMaterial({color:c,emissive:c,emissiveIntensity:.35}),s,s,s,Math.cos(a)*rr,y,Math.sin(a)*rr));if(i%2){const t=new THREE.Mesh(GEO.torus,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.6}));t.scale.setScalar(s*1.6);t.rotation.x=1.2;t.position.set(Math.cos(a)*rr,y,Math.sin(a)*rr);g.add(t)}}
    for(let i=0;i<10;i++){const a=r()*6.28,rr=20+r()*45;g.add(prim('oct',new THREE.MeshLambertMaterial({color:cols[i%5],emissive:cols[i%5],emissiveIntensity:.4}),1.5,4,1.5,Math.cos(a)*rr,2,Math.sin(a)*rr))}
  }
  // chests & stars (seeded)
  const cr=rngSeed(500+k*13);
  for(let i=0;i<4;i++){const a=cr()*6.28,rr=20+cr()*42,x=Math.cos(a)*rr,z=Math.sin(a)*rr;const c=new THREE.Group();c.position.set(x,0,z);c.add(prim('box',M(0xb3701c),1.5,.9,1,0,.45,0));const lid=prim('box',M(0xffd34d,{emissive:0x553300}),1.6,.35,1.1,0,1.05,0);c.add(lid);c.add(prim('box',M(0xffffff),.25,.35,1.15,0,.9,0));g.add(c);G.chests.push({i,x,z,g:c,lid})}
  for(let i=0;i<6;i++){const a=cr()*6.28,rr=14+cr()*55,x=Math.cos(a)*rr,z=Math.sin(a)*rr;const s=new THREE.Group();s.position.set(x,1.6,z);const st=prim('oct',new THREE.MeshBasicMaterial({color:0xfff27a}),.6,.8,.3);s.add(st);const st2=prim('oct',new THREE.MeshBasicMaterial({color:0xfff27a}),.8,.6,.3);st2.rotation.z=.78;s.add(st2);g.add(s);G.stars.push({i,x,z,g:s})}
  hero.pos.set(0,0,8);hero.vy=0;G.combo=0;
  AU.setWorld(k);fillEnemies();
  $('worldname').textContent=W.n;
}
function travel(k){
  if(!S.worlds.includes(k))return false;S.world=k;buildWorld(k);saveGame();banner(WORLDS[k].n.toUpperCase(),WORLDS[k].desc);return true}

// ===================== PLAYER UPDATE / CAMERA =====================
const cam={yaw:0,pitch:.38,dist:11};
const camFwd=()=>[-Math.sin(cam.yaw),-Math.cos(cam.yaw)];
let gp={mx:0,mz:0,cx:0,cy:0,jump:false,whip:false,use:false,sprint:false,start:false,prev:{}};
function pollPad(){
  const p=(navigator.getGamepads?navigator.getGamepads():[])[0];gp.mx=gp.mz=gp.cx=gp.cy=0;gp.jump=gp.whip=gp.use=gp.sprint=false;if(!p)return;
  const dz=v=>Math.abs(v)<.18?0:v;gp.mx=dz(p.axes[0]);gp.mz=-dz(p.axes[1]);gp.cx=dz(p.axes[2]);gp.cy=dz(p.axes[3]);
  const b=i=>p.buttons[i]&&p.buttons[i].pressed;gp.jump=b(0);gp.whip=b(2)||b(7);gp.use=b(3);gp.sprint=b(1)||b(5)||b(10);
  const st=b(9);if(st&&!gp.prev.start)togglePanel('shop');gp.prev.start=st;
}
function updPlayer(dt){
  pollPad();
  let ix=(K.KeyD?1:0)-(K.KeyA?1:0)+gp.mx,iz=(K.KeyW?1:0)-(K.KeyS?1:0)+gp.mz;
  const l=Math.hypot(ix,iz);if(l>1){ix/=l;iz/=l}
  if(K.ArrowLeft)cam.yaw+=dt*2.2;if(K.ArrowRight)cam.yaw-=dt*2.2;if(K.ArrowUp)cam.pitch=clamp(cam.pitch+dt*1.2,.05,1.2);if(K.ArrowDown)cam.pitch=clamp(cam.pitch-dt*1.2,.05,1.2);
  cam.yaw-=gp.cx*dt*2.6;cam.pitch=clamp(cam.pitch-gp.cy*dt*1.6,.05,1.2);
  const frozen=G.cinematic>0;if(frozen){ix=iz=0}
  const[fx,fz]=camFwd(),rx=Math.cos(cam.yaw),rz=-Math.sin(cam.yaw);
  const dx=fx*iz+rx*ix,dz=fz*iz+rz*ix,mag=Math.hypot(dx,dz);
  const sprint=(K.ShiftLeft||K.ShiftRight||gp.sprint)&&mag>0;
  const sp=(sprint?14:9)*(1+petBonus('speed'))*(hero.swing>=0?.6:1);
  hero.speed=mag>0?sp:0;
  if(mag>.05){hero.pos.x+=dx/Math.max(mag,1)*sp*dt;hero.pos.z+=dz/Math.max(mag,1)*sp*dt;hero.walk+=dt*(sprint?15:11);
    if(hero.swing<0){const ty=Math.atan2(dx,dz);let d=ty-hero.yaw;while(d>Math.PI)d-=6.283;while(d<-Math.PI)d+=6.283;hero.yaw+=d*Math.min(1,dt*14)}G.emote=null}
  // jump & gravity
  if((K.Space||gp.jump)&&hero.ground&&!frozen){hero.vy=11.5;hero.ground=false;AU.jump()}
  if(!hero.ground||hero.pos.y>0){hero.vy-=30*dt;hero.pos.y+=hero.vy*dt;if(hero.pos.y<=0){hero.pos.y=0;if(!hero.ground){hero.land=1;burst(hero.pos.x,.2,hero.pos.z,6,0xffffff,3,.4)}hero.ground=true;hero.vy=0}}
  // colliders
  for(const c of G.colliders){const ex=hero.pos.x-c.x,ez=hero.pos.z-c.z,d=Math.hypot(ex,ez),m=c.r+.6;if(d<m&&d>0&&hero.pos.y<2.5){hero.pos.x=c.x+ex/d*m;hero.pos.z=c.z+ez/d*m}}
  const r=Math.hypot(hero.pos.x,hero.pos.z);if(r>74){hero.pos.x*=74/r;hero.pos.z*=74/r}
  if(K.KeyJ||K.MouseL||gp.whip||(S.settings.autoWhip&&nearestEnemy(curWhip().reach*.9)))tryWhip();
  animHero(dt,mag>.05);
}
function updCamera(dt){
  let tx=hero.pos.x,ty=hero.pos.y+2.4,tz=hero.pos.z;
  const cd=cam.dist+(hero.speed>11?1.5:0),cp=cam.pitch;
  let px=tx+Math.sin(cam.yaw)*Math.cos(cp)*cd,py=ty+Math.sin(cp)*cd+.5,pz=tz+Math.cos(cam.yaw)*Math.cos(cp)*cd;
  if(G.cinematic>0&&G.cinCam&&G.boss){const e=G.boss.e;const p=1-G.cinematic/3.2;
    px=e.x+Math.sin(p*1.2)*20;py=4+p*6;pz=e.z+Math.cos(p*1.2)*22;tx=e.x;ty=4+p*3;tz=e.z}
  py=Math.max(py,.6);
  camera.position.lerp(_v.set(px,py,pz),G.cinematic>0?.12:.25);
  let sh=G.shake;if(!S.settings.shake)sh=0;
  if(sh>0)camera.position.add(_v.set(rnd(-sh,sh),rnd(-sh,sh),rnd(-sh,sh)));
  camera.lookAt(tx,ty,tz);G.shake=Math.max(0,G.shake-dt*1.8);
}

// ===================== PETS (3D followers) =====================
const petMeshes=[];
function rebuildPets(){
  for(const p of petMeshes)scene.remove(p.g);petMeshes.length=0;
  S.equipped.forEach((id,i)=>{const d=PETS[id],g=new THREE.Group();
   const m=M(d.c,{emissive:d.r>=3?d.c:0,emissiveIntensity:.25});g.add(prim('sphere',m,.5,.45,.5,0,.5,0));
   for(const s of[-1,1]){g.add(prim('sphere',M(0xffffff),.12,.14,.06,s*.2,.65,.42));g.add(prim('sphere',M(0x111111),.06,.07,.04,s*.2,.65,.47));g.add(prim('sphere',m,.14,.2,.1,s*.28,1,0))}
   if(d.r>=2){const t=new THREE.Mesh(GEO.torus,new THREE.MeshBasicMaterial({color:[0,0,0xc060ff,0xffd34d,0xff5fa2][d.r]}));t.scale.setScalar(.7);t.rotation.x=Math.PI/2;t.position.y=1.3;g.add(t)}
   g.position.copy(hero.pos);scene.add(g);petMeshes.push({g,i,id})});
}
function updPets(dt){
  const t=G.time;for(const p of petMeshes){
   const a=hero.yaw+Math.PI+(p.i-(petMeshes.length-1)/2)*.9,tx=hero.pos.x+Math.sin(a)*2.6,tz=hero.pos.z+Math.cos(a)*2.6;
   p.g.position.x=lerp(p.g.position.x,tx,Math.min(1,dt*5));p.g.position.z=lerp(p.g.position.z,tz,Math.min(1,dt*5));
   const moving=hero.speed>0;p.g.position.y=hero.pos.y*.7+(moving?Math.abs(Math.sin(t*9+p.i))*.5:Math.sin(t*3+p.i)*.08);
   p.g.rotation.y=Math.atan2(hero.pos.x-p.g.position.x,hero.pos.z-p.g.position.z)}
}

// ===================== FLOATING TEXT & TOASTS =====================
const fxLayer=document.getElementById('fx');
function ftext(x,y,z,txt,cls){
  if(fxLayer.children.length>35)fxLayer.removeChild(fxLayer.firstChild);
  const v=new THREE.Vector3(x,y,z).project(camera);if(v.z>1)return;
  const d=document.createElement('div');d.className='ft '+(cls||'');d.textContent=txt;d.style.left=((v.x+1)/2*innerWidth)+'px';d.style.top=((1-v.y)/2*innerHeight)+'px';
  fxLayer.appendChild(d);setTimeout(()=>d.remove(),900)}
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;const c=$('toasts');c.appendChild(t);while(c.children.length>5)c.removeChild(c.firstChild);setTimeout(()=>t.remove(),4100)}
function banner(a,b){const e=$('banner');e.innerHTML=a+(b?'<small>'+b+'</small>':'');e.classList.remove('show');void e.offsetWidth;e.classList.add('show')}
function $(id){return document.getElementById(id)}

// ===================== ACHIEVEMENTS =====================
function checkAch(){for(const a of ACH){if(!S.ach[a.id]&&a.t(S)){S.ach[a.id]=1;gainGems(2,'');toast('🏆 Achievement: '+a.n);AU.up()}}}

// ===================== MAIN LOOP =====================
function stepGame(dt){
    const play=!G.panel;
    if(play){
      G.time+=dt;S.stats.playtime+=dt;
      if(G.comboT>0){G.comboT-=dt;if(G.comboT<=0)G.combo=0}
      if(G.inv>0)G.inv-=dt;if(G.bossCool>0)G.bossCool-=dt;
      updPlayer(dt);updSwing(dt);updEnemies(dt);updBoss(dt);updPickups(dt);updPets(dt);
      if(G.boss&&G.boss.state!=='intro'){const m=G.boss.e;}
      // interactions
      G.prompt='';
      const ad=Math.hypot(hero.pos.x,hero.pos.z+38);
      if(!G.boss&&ad<6){G.prompt=G.bossCool>0?'Altar recharging... '+Math.ceil(G.bossCool)+'s':'[E] Challenge '+WORLDS[S.world].boss.n+'!';
        if((K.KeyE||gp.use)&&G.bossCool<=0){startBoss()}}
      G.saveT+=dt;if(G.saveT>10){G.saveT=0;saveGame()}
      G.achT+=dt;if(G.achT>1){G.achT=0;checkAch()}
      if(!G.boss&&G.enemies.length<10)fillEnemies();
      // ambient weather per world
      if(Math.random()<dt*14){const wc=[0xffffff,0xffd34d,0xff9a5a,0xffffff,0x80ffe0][S.world];P(hero.pos.x+rnd(-26,26),rnd(10,18),hero.pos.z+rnd(-26,26),rnd(-.6,.6),-rnd(1.5,3),rnd(-.6,.6),rnd(3,5),wc,{gr:0})}
      // upgrade hint
      const nx=WHIPS.find(w=>!w.secret&&!S.whips.includes(w.id)&&w.id>S.whip);G.canBuy=!!(nx&&S.coins>=nx.price);
      if(G.canBuy&&G.hintFor!==nx.id){G.hintFor=nx.id;toast('You can afford '+nx.name+'! Press B to open the shop.');AU.up()}
    }
}

let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(G.started){
    stepGame(dt);
    updWhip(dt);
    updParts(dt);updCamera(dt);
    if(G.altar)G.altar.children[1].rotation.z+=dt;
    updHUD(dt);
  }else{
    // title screen orbit
    G.time+=dt;camera.position.set(Math.sin(G.time*.15)*30,12,Math.cos(G.time*.15)*30);camera.lookAt(0,3,0);updParts(dt);animHero(dt,false);
  }
  renderer.render(scene,camera);
}
