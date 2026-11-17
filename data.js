'use strict';
// ===================== STATIC GAME DATA =====================
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rnd=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
function rngSeed(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function fmt(n){n=Math.floor(n);if(n<1000)return''+n;const u=['','K','M','B','T','Qa','Qi','Sx'];let i=0,x=n;while(x>=1000&&i<u.length-1){x/=1000;i++}return parseFloat((x>=100?x.toFixed(0):x>=10?x.toFixed(1):x.toFixed(2)))+u[i]}
const sig2=n=>{if(n<100)return Math.round(n);const p=Math.pow(10,Math.floor(Math.log10(n))-1);return Math.round(n/p)*p};
const WSCALE=28; // difficulty/economy multiplier per world
const wBase=k=>Math.pow(WSCALE,k);

// ---- Whips ----
const WHIP_NAMES=['String Whip','Licorice Whip','Candy Cane Whip','Gumdrop Lasso','Caramel Whip','Taffy Stretcher','Chocolate Chain','Jawbreaker Flail','Rainbow Whip','Cotton Candy Cord','Peppermint Lash','Lightning Licorice','Toffee Thunder','Sherbet Serpent','Frozen Fudge Flail','Glacier Gummy Lash','Sorbet Spiral','Permafrost Pretzel','Galactic Sugar Whip','Nebula Ribbon','Comet Caramel Nine-Tail','Starlight Strand','Quasar Quiver','Cosmic Chocolate Whip','Black Hole Bonbon','Supernova Sprinkle','Dimensional Dragée','Mythic Marshmallow Mauler','Eternity Éclair','Reality Breaker','The Golden Wrapper (Secret)'];
const WHIP_COL=[[0xd8c9a8,0xf5ecd6],[0x222222,0xd02040],[0xffffff,0xe0203a],[0x60d060,0xff7090],[0xc98a2e,0xf2b84a],[0xff8ab8,0xffd1e6],[0x5a3320,0x8b5a3a],[0x40a0ff,0xff60c0],[0xff4040,0x40ff80],[0xff9ed2,0x9ee0ff],[0xffffff,0x20c070],[0x222244,0xfff04a],[0xd9902f,0xffe680],[0xff8a3c,0xffe14a],[0x6ad0ff,0x3a2018],[0x9ae8ff,0xffffff],[0xff7ad0,0x7affd9],[0xb0f0ff,0x7aa0ff],[0x9b5cff,0xff7ae6],[0xff5cd0,0x5c7aff],[0xffb040,0xff4040],[0xfffbd0,0xffe14a],[0x40ffe0,0x5040ff],[0x3a1a60,0xff8a00],[0x111111,0x9b5cff],[0xff4040,0xffee66],[0xe0e0ff,0xff60ff],[0xffffff,0xffc0e0],[0xffd700,0x5a3320],[0xffffff,0x00ffff],[0xffd700,0xffffff]];
const WHIPS=WHIP_NAMES.map((n,i)=>{
  const secret=i===30;const power=secret?Math.round(Math.pow(1.75,30)*1.5):Math.max(1,Math.round(Math.pow(1.75,i)));
  const fx=i<3?'plain':i<8?'sparkle':i<11?'rainbow':i<14?'lightning':i<18?'ice':i<23?'star':i<30?'cosmic':'gold';
  return{id:i,name:n,power,price:secret?0:i===0?0:sig2(power*18),c1:WHIP_COL[i][0],c2:WHIP_COL[i][1],fx,secret,reach:3.2+0.28*i,cd:Math.max(0.22,0.5-0.008*i),
    tier:i<6?'Common':i<12?'Rare':i<18?'Epic':i<24?'Legendary':i<30?'Mythical':'Secret'};
});

// ---- Creatures & Worlds ----
const T=[{hp:1,coin:1,s:1},{hp:2.5,coin:2.6,s:1.3},{hp:6,coin:6.5,s:1.7}];
const mk=(n,shape,c,a,feat,t,w)=>({n,shape,c,a,feat,hp:T[t].hp,coin:T[t].coin,s:T[t].s,w});
const WORLDS=[
 {n:'Candy Floss Fields',desc:'Pink cotton-candy grass, sweet trees and a cozy starter village.',ground:0xff9ed2,patch:0xffb8de,sky:0xbfe9ff,fog:0xdff3ff,cost:0,
  enemies:[mk('Mini Snickerling','bar',0x7a4a2a,0xe9a63a,'nuts',0,5),mk('Caramel Crawler','bar',0x6a3a1a,0xe8902a,'claws',1,3),mk('Peanut Cruncher','bar',0x7a4a2a,0xf2c27a,'horns',2,2)],
  boss:{n:'King Snickerling',shape:'bar',c:0x5a3320,a:0xf2c27a,feat:'crown',hp:60,coin:80,gems:6},music:{root:261.6,sc:[0,2,4,7,9,12],bpm:104,wave:'triangle'}},
 {n:'Caramel Canyon',desc:'Flowing caramel rivers, golden cliffs and hidden treasure.',ground:0xe9b25a,patch:0xf5c878,sky:0xffd9a0,fog:0xffe6bd,cost:300,
  enemies:[mk('Toffee Tumbler','blob',0xc47a1e,0xffd27a,'spikes',0,5),mk('Butterscotch Beetle','crab',0xe8a020,0x7a4a10,'horns',1,3),mk('Fudge Brute','tall',0x6a3a1a,0xe8a020,'horns',2,2)],
  boss:{n:'The Caramel Colossus',shape:'tall',c:0xc47a1e,a:0xffe0a0,feat:'horns',hp:60,coin:80,gems:9},music:{root:293.7,sc:[0,2,4,5,7,9,10],bpm:92,wave:'sine'}},
 {n:'Chocolate Kingdom',desc:'Massive chocolate castles, candy knights and giant bosses.',ground:0x6a3f26,patch:0x7d4e32,sky:0x7a5a88,fog:0x8a6a98,cost:8400,
  enemies:[mk('Nougat Knight','tall',0xf4e4c8,0x8a8a9a,'helmet',0,5),mk('Choco Guard','bar',0x3a2014,0xc0c0d0,'helmet',1,3),mk('Giant Chocolate Golem','blob',0x4a2a18,0xffd34d,'spikes',2,2)],
  boss:{n:'Emperor Nougat',shape:'bar',c:0xf4e4c8,a:0x5a3320,feat:'crown',hp:60,coin:80,gems:12},music:{root:220,sc:[0,3,5,7,10,12],bpm:84,wave:'square'}},
 {n:'Frozen Ice Cream Tundra',desc:'Ice cream mountains, frozen lakes and snow-cone creatures.',ground:0xeaf7ff,patch:0xcfeaff,sky:0xbfe0ff,fog:0xe3f1ff,cost:235200,
  enemies:[mk('Snow-Cone Sprite','cone',0x9ae8ff,0xff7ad0,'hat',0,5),mk('Frosty Scoop','blob',0xffffff,0xffb8e0,'nuts',1,3),mk('Sorbet Yeti','tall',0xbfd8ff,0xffffff,'horns',2,2)],
  boss:{n:'The Chocolate Devourer',shape:'blob',c:0x3a2014,a:0xff7ad0,feat:'spikes',hp:60,coin:80,gems:15},music:{root:329.6,sc:[0,2,4,7,9,14],bpm:80,wave:'sine'}},
 {n:'Galactic Candy Dimension',desc:'Floating islands, neon candy planets and cosmic monsters.',ground:0x34206e,patch:0x4a2e96,sky:0x0a0420,fog:0x1a0a40,cost:6585600,
  enemies:[mk('Gummy Blob Alien','blob',0x40ffb0,0xff40a0,'antenna',0,5),mk('Neon Nougat Nova','bar',0x9b5cff,0xffee66,'spikes',1,3),mk('Cosmic Cocoa Crab','crab',0x2a1a50,0x40ffe0,'claws',2,2)],
  boss:{n:'Cosmic Candy Overlord',shape:'cone',c:0x7a3cff,a:0xff5cd0,feat:'crown',hp:60,coin:80,gems:20},music:{root:174.6,sc:[0,2,4,6,7,9,11],bpm:118,wave:'sawtooth'}}
];

// ---- Pets ----
const RARITY=[{n:'Common',w:55},{n:'Rare',w:28},{n:'Epic',w:12},{n:'Legendary',w:4.5},{n:'Mythic',w:.5}];
const PETS=[
 {id:0,n:'Gummy Bear',r:0,c:0xff4060,b:{coin:.06}},{id:1,n:'Chocolate Hamster',r:0,c:0x8a5a3a,b:{dmg:.06}},{id:2,n:'Jelly Bean Bunny',r:0,c:0x7ad07a,b:{speed:.06}},
 {id:3,n:'Caramel Fox',r:1,c:0xe0902a,b:{coin:.15}},{id:4,n:'Cotton Cloud Lamb',r:1,c:0xbfe9ff,b:{luck:.25}},
 {id:5,n:'Marshmallow Dragon',r:2,c:0xffffff,b:{dmg:.3,luck:.1}},{id:6,n:'Rainbow Donut',r:2,c:0xff9ed2,b:{coin:.25,speed:.08}},
 {id:7,n:'Golden Lollipop Phoenix',r:3,c:0xffd34d,b:{coin:.45,dmg:.35}},{id:8,n:'Cosmic Cupcake',r:4,c:0x9b5cff,b:{coin:.6,dmg:.6,luck:.3,speed:.1}}];
const BN={coin:'Coins',dmg:'Damage',luck:'Luck',speed:'Speed'};

// ---- Cosmetics ----
const SKINS=[{n:'Classic White',c:0xfff4e0,cost:0},{n:'Strawberry Cream',c:0xffb6d0,cost:10},{n:'Mint Crunch',c:0xaaf0d1,cost:15},{n:'Milk Chocolate',c:0xb8814f,cost:20},{n:'Gold Foil',c:0xffd34d,cost:40},{n:'Galaxy Bar',c:0x6b4be0,cost:60,em:0x2a1a80},{n:'Rainbow Bar',c:0xffffff,cost:100,rainbow:1}];
const HATS=[{n:'No Hat',cost:0},{n:'Party Cone',cost:8},{n:'Halo',cost:25},{n:'Royal Crown',cost:30},{n:'Wizard Hat',cost:35},{n:'Propeller Cap',cost:40}];
const EMOTES=['Dance','Wave','Flex','Spin'];

// ---- Achievements ----
const ACH=[
 {id:'k1',n:'First Whip!',d:'Defeat your first creature',t:s=>s.stats.kills>=1},
 {id:'k100',n:'Candy Crusher',d:'Defeat 100 creatures',t:s=>s.stats.kills>=100},
 {id:'k1000',n:'Sugar Slayer',d:'Defeat 1,000 creatures',t:s=>s.stats.kills>=1000},
 {id:'w5',n:'Collector',d:'Own 5 whips',t:s=>s.whips.length>=5},
 {id:'w15',n:'Whip Hoarder',d:'Own 15 whips',t:s=>s.whips.length>=15},
 {id:'w30',n:'Armory Complete',d:'Own all 30 purchasable whips',t:s=>s.whips.filter(i=>i<30).length>=30},
 {id:'c1m',n:'Millionaire Bar',d:'Earn 1M coins total',t:s=>s.stats.coinsEarned>=1e6},
 {id:'c1b',n:'Candy Tycoon',d:'Earn 1B coins total',t:s=>s.stats.coinsEarned>=1e9},
 {id:'b1',n:'Boss Basher',d:'Defeat a boss',t:s=>s.stats.bosses>=1},
 {id:'b5',n:'Boss Rush',d:'Defeat all 5 bosses',t:s=>Object.keys(s.bossKills).length>=5},
 {id:'g1',n:'Gold Rush',d:'Defeat a golden creature',t:s=>s.stats.golden>=1},
 {id:'cb',n:'Combo Master',d:'Reach a x25 combo',t:s=>s.stats.maxCombo>=25},
 {id:'ch',n:'Treasure Hunter',d:'Open 10 treasure chests',t:s=>s.stats.chests>=10},
 {id:'st',n:'Star Gazer',d:'Collect 15 Sugar Stars',t:s=>s.stars.length>=15},
 {id:'pet',n:'Pet Parent',d:'Hatch 5 pets',t:s=>s.stats.eggs>=5},
 {id:'lv',n:'Level 25',d:'Reach player level 25',t:s=>s.level>=25},
 {id:'w5w',n:'World Traveler',d:'Unlock all 5 worlds',t:s=>s.worlds.length>=5},
 {id:'rb',n:'Born Again',d:'Rebirth for the first time',t:s=>s.rebirths>=1}];
