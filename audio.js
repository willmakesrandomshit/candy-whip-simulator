'use strict';
// ===================== SYNTHESIZED AUDIO (no asset files) =====================
const AU={ctx:null,master:null,mus:null,sfx:null,noise:null,world:0,boss:false,step:0,next:0,timer:null,
 init(){
  if(this.ctx)return;
  try{
   const C=window.AudioContext||window.webkitAudioContext;this.ctx=new C();
   this.master=this.ctx.createGain();this.mus=this.ctx.createGain();this.sfx=this.ctx.createGain();
   this.mus.connect(this.master);this.sfx.connect(this.master);this.master.connect(this.ctx.destination);
   const n=this.ctx.sampleRate;const b=this.ctx.createBuffer(1,n,n),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;this.noise=b;
   this.vol();this.next=this.ctx.currentTime+.1;
   this.timer=setInterval(()=>this.sched(),80);
  }catch(e){console.warn('Audio unavailable',e)}
 },
 vol(){if(!this.ctx)return;const s=S.settings;this.master.gain.value=s.master;this.mus.gain.value=s.music*.35;this.sfx.gain.value=s.sfx},
 resume(){if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume()},
 tone(f,t,dur,type,vol,dest,slide){
  const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,slide),t+dur);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g);g.connect(dest||this.sfx);o.start(t);o.stop(t+dur+.05);
 },
 nz(t,dur,f0,f1,vol,type){
  const c=this.ctx,s=c.createBufferSource();s.buffer=this.noise;const f=c.createBiquadFilter();f.type=type||'highpass';
  f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+dur);
  const g=c.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(f);f.connect(g);g.connect(this.sfx);s.start(t);s.stop(t+dur+.05);
 },
 whip(tier){if(!this.ctx)return;const t=this.ctx.currentTime;this.nz(t,.18,1500+tier*60,6000,.5);this.nz(t+.1,.06,4000,9000,.7);this.tone(900+tier*30,t+.1,.05,'square',.15)},
 hit(big){if(!this.ctx)return;const t=this.ctx.currentTime;this.tone(220,t,.15,'sine',.5,null,60);this.tone(500+Math.random()*200,t,.08,'triangle',.2,null,200);if(big)this.nz(t,.2,3000,300,.3,'lowpass')},
 coin(c){if(!this.ctx)return;const t=this.ctx.currentTime,p=1+Math.min(c,30)*.03;this.tone(988*p,t,.08,'square',.12);this.tone(1318*p,t+.07,.2,'square',.12)},
 up(){if(!this.ctx)return;const t=this.ctx.currentTime;[523,659,784,1046,1318].forEach((f,i)=>this.tone(f,t+i*.08,.25,'triangle',.3))},
 buy(){if(!this.ctx)return;const t=this.ctx.currentTime;[392,523,659,784].forEach((f,i)=>this.tone(f,t+i*.06,.2,'square',.15))},
 err(){if(!this.ctx)return;const t=this.ctx.currentTime;this.tone(180,t,.2,'sawtooth',.2,null,90)},
 boom(){if(!this.ctx)return;const t=this.ctx.currentTime;this.tone(90,t,.5,'sine',.8,null,30);this.nz(t,.5,2000,100,.5,'lowpass')},
 roar(){if(!this.ctx)return;const t=this.ctx.currentTime;this.tone(110,t,1.2,'sawtooth',.4,null,50);this.tone(116,t,1.2,'square',.25,null,55);this.nz(t,1.2,800,100,.3,'lowpass')},
 jump(){if(!this.ctx)return;const t=this.ctx.currentTime;this.tone(300,t,.15,'sine',.2,null,700)},
 tele(){if(!this.ctx)return;const t=this.ctx.currentTime;this.tone(440,t,.15,'square',.15);this.tone(440,t+.2,.15,'square',.15)},
 setWorld(w){this.world=w},setBoss(b){this.boss=b},
 sched(){
  if(!this.ctx||this.ctx.state!=='running')return;
  const m=WORLDS[this.world].music,boss=this.boss;const bpm=m.bpm*(boss?1.35:1);const sd=60/bpm/2;
  while(this.next<this.ctx.currentTime+.25){
   const t=this.next,st=this.step%32,sc=boss?[0,3,5,6,7,10,12]:m.sc,root=m.root*(boss?.5:1);
   const note=i=>root*Math.pow(2,sc[((i%sc.length)+sc.length)%sc.length]/12+Math.floor(i/sc.length));
   if(st%8===0){this.tone(note(0)/2,t,sd*7,boss?'sawtooth':m.wave,.5,this.mus)}
   if(st%8===4)this.tone(note([0,2,3,1][(st>>3)%4])/2,t,sd*3,boss?'sawtooth':m.wave,.35,this.mus);
   if(boss&&st%4===0){this.tone(120,t,.12,'sine',.7,this.mus,40)}
   if(boss&&st%4===2){this.nz(t,.05,6000,8000,.12);}
   const idx=[0,2,4,2,5,4,2,1][st%8]+((st>>3)%4)*[0,1,2,1][(st>>3)%4];
   if(Math.random()<(boss?.85:.7))this.tone(note(idx+sc.length),t,sd*1.4,boss?'square':m.wave,.22,this.mus);
   if(st%16===0&&!boss)this.tone(note(4+sc.length*2),t,sd*4,'sine',.12,this.mus);
   this.next+=sd;this.step++;
  }
 }};
