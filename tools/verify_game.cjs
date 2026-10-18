/* Logic checks using only Node built-ins. The drawing surface and media devices
   are stubs; visual checks and audible playback require a real browser. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const handlers = {}, storage = {};
const gradient = {addColorStop(){}};
const surface = new Proxy({}, {get(object,key){
  if(key==='createLinearGradient'||key==='createRadialGradient')return()=>gradient;
  if(!(key in object))object[key]=()=>{};
  return object[key];
}});
class Element {
  constructor(id){this.id=id;this.hidden=false;this.dataset={};this.style={};this.classList={add(){},remove(){},toggle(){}};}
  addEventListener(type,handler){handlers[this.id+':'+type]=handler;}
  getBoundingClientRect(){return{width:1280,height:720};}
  getContext(){return surface;}
  setAttribute(){}append(){}focus(){}remove(){}setPointerCapture(){}
}
class Param {
  setValueAtTime(v){assert(Number.isFinite(v));}
  exponentialRampToValueAtTime(v){assert(v>0&&Number.isFinite(v));}
  setTargetAtTime(v){assert(Number.isFinite(v));}
}
let notes=0;
class SoundNode {
  constructor(){this.gain=new Param();this.frequency=new Param();this.threshold={value:0};}
  connect(){}start(){notes++;}stop(){}
}
class AudioContext {
  constructor(){this.currentTime=0;this.state='running';this.destination={};}
  createGain(){return new SoundNode();}createOscillator(){return new SoundNode();}
  createDynamicsCompressor(){return new SoundNode();}createBiquadFilter(){return new SoundNode();}
}
class Media {
  constructor(){this.paused=true;this.volume=0;}
  play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}addEventListener(){}
}
const elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
const touch=['left','right','jump','dash'].map(k=>{const e=element('touch-'+k);e.dataset.control=k;return e;});
const sandbox={
  console,Math,Date,Set,Map,Number,Audio:Media,
  window:{AudioContext,devicePixelRatio:1,addEventListener:(type,fn)=>handlers['window:'+type]=fn},
  document:{hidden:false,getElementById:element,querySelectorAll:()=>touch,createElement:()=>new Element(),createTextNode:()=>new Element(),addEventListener(){}},
  localStorage:{getItem:k=>storage[k],setItem:(k,v)=>storage[k]=v,removeItem:k=>delete storage[k]},
  navigator:{getGamepads:()=>[]},matchMedia:()=>({matches:false}),
  performance:{now:()=>0},requestAnimationFrame(){},setInterval(){},setTimeout(){}
};
sandbox.window.PetalAssets={images:{},failures:[],music:['meadow','clouds','desert','twilight'].map(n=>`assets/audio/${n}.wav`),ready:Promise.resolve()};
vm.createContext(sandbox);
for(const file of ['audio.js','art.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),sandbox);
const source=fs.readFileSync(path.join(root,'src/game.js'),'utf8').replace(/\}\)\(\);\s*$/,
  'globalThis.test={game,input,World,start,update,render,collect,hitBlock,hurt,die,togglePause,saveStory,resumeStory,readSavedStory,makeKeeper,updateDeluxe,audio};})();');
assert(source.includes('globalThis.test='),'Test export insertion failed');
vm.runInContext(source,sandbox);
const api=sandbox.test,g=api.game,keys=api.input;
function step(n=1){for(let i=0;i<n;i++)api.update(1/120);}
function reset(){api.start('story');step(5);g.player.invincible=0;}
reset();assert(g.player.grounded);
let base=g.player.y,apex=base;keys.jump=true;keys.buffer=.13;
for(let i=0;i<110;i++){step();apex=Math.min(apex,g.player.y);}
const height=base-apex;assert(height>125&&height<140);assert(g.player.grounded);
keys.jump=false;step(2);keys.jump=true;keys.buffer=.13;step(5);keys.jump=false;apex=base;
for(let i=0;i<100;i++){step();apex=Math.min(apex,g.player.y);}assert(base-apex<height*.8);
reset();g.player.x=380;keys.right=true;keys.jump=true;keys.buffer=.13;step(90);
assert(g.player.grounded&&g.player.y+g.player.h===464,'Opening platform reach');
reset();g.player.grounded=false;g.player.coyote=.05;g.player.y-=5;keys.buffer=.13;keys.jump=true;step();assert(g.player.vy<0,'Coyote jump');
reset();g.player.y=523;g.player.vy=100;g.player.grounded=false;keys.buffer=.13;keys.jump=true;step(20);assert(g.player.vy<0,'Buffered jump');
reset();const block=g.world.blocks.find(b=>b.type==='prize');g.player.x=block.x+8;g.player.y=block.y+46;g.player.vy=-300;step(2);assert(block.used,'Actual head collision');
const lotus=g.world.pickups.find(p=>p.type==='lotus');api.collect(lotus);assert(!g.player.big,'Growth waits for headroom');g.player.x=110;g.player.y=532;api.collect(lotus);assert(g.player.big&&g.player.h===68);
const brick=g.world.blocks.find(b=>b.type==='brick');api.hitBlock(brick,true);assert(brick.dead);
api.collect({x:110,y:500,type:'star'});assert(g.player.flight===25);g.player.grounded=false;g.player.coyote=0;keys.buffer=.13;keys.jump=true;step();assert(!g.player.airJump&&g.player.vy<0);
g.player.vy=500;step();assert(g.player.vy<=95);keys.dashPress=true;step();assert(g.player.dash>0);
g.player.invincible=0;api.hurt();assert(!g.player.big&&g.player.flight===0&&g.player.invincible>0);
reset();g.mode='endless';
for(let i=0;i<1000;i++){g.checkpoint=Math.floor(i*960/4800)*4800;g.world.stream(i*960,g.checkpoint);}
assert(g.world.chunks.size<12,'Bounded streamed memory');
const world=new api.World(45237);
for(let i=0;i<400;i++){
  world.generate(i);const c=world.chunks.get(i),floors=c.ground.slice().sort((a,b)=>a.x-b.x);
  assert(floors[0].x===i*960);assert(floors.at(-1).x+floors.at(-1).w===(i+1)*960);
  for(let j=1;j<floors.length;j++)assert(floors[j].x-floors[j-1].x-floors[j-1].w<=110);
}
reset();g.player.x=4920;step();assert(g.checkpoint===4800&&g.lives===4);api.die();step(160);assert(g.state==='PLAYING'&&g.player.x>=4800);
g.lives=1;api.die();step(160);assert(g.state==='GAMEOVER');
reset();g.checkpoint=4800;g.nextCheckpoint=9600;g.maxX=5000;g.score=4500;g.relics.add(0);api.saveStory();assert(api.readSavedStory().score===4500);
api.resumeStory();assert(g.player.x===4915&&g.relics.has(0)&&g.score===4500);
api.togglePause();let x=g.player.x;step(30);assert(g.state==='PAUSED'&&g.player.x===x);api.togglePause();assert(g.state==='PLAYING');
const event=code=>({code,repeat:false,preventDefault(){}});
handlers['window:keydown'](event('KeyD'));assert(keys.right);handlers['window:keyup'](event('KeyD'));assert(!keys.right);
handlers['touch-right:pointerdown']({pointerId:1,preventDefault(){}});handlers['touch-jump:pointerdown']({pointerId:2,preventDefault(){}});assert(keys.right&&keys.jump);
handlers['touch-jump:pointerup']({pointerId:2});assert(keys.right&&!keys.jump);handlers['touch-right:pointercancel']({pointerId:1});assert(!keys.right);
reset();g.checkpoint=38400;g.nextCheckpoint=43200;g.player.x=38800;g.maxX=38800;g.world.stream(38800,38400);g.boss=api.makeKeeper();g.boss.active=true;
assert(g.world.chunks.get(41).enemies.length===0,'Guardian arena is clear');
for(let i=0;i<5;i++){
  const b=g.boss;b.t=4;b.y=506;b.flash=0;b.shootClock=99;
  g.player.x=38400+720+Math.sin((4+1/120)*.7)*210;g.player.y=475;g.player.dash=.1;
  api.updateDeluxe(1/120,450);assert(b.hp===4-i);
}
assert(g.boss.defeated);g.player.x=39900;api.updateDeluxe(1/120,500);assert(g.state==='VICTORY');assert(!storage['petalbound-deluxe-story']);
api.start('endless');assert(g.mode==='endless'&&g.lives===3);g.checkpoint=33600;g.nextCheckpoint=38400;g.player.x=38520;step();assert(g.season===1);
for(const sound of ['jump','coin','stomp','bump','power','checkpoint','hurt','dash'])api.audio.fx(sound);assert(notes>15);
api.render();
console.log(`PASS: physics, platform reach, powers, 400 templates, 1,000-chunk streaming, saves, controls, audio envelopes, guardian and ending. Jump height ${height.toFixed(2)}.`);
