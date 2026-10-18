
/* PETALBOUND DELUXE — The Four Lights.
   Build-free Canvas game with bundled painted sprites and instrumental WAV loops.
   Fixed 120 Hz physics; seeded chunk streaming; local story and preference saves.
   Runtime dependencies: the included asset folder and modern browser APIs only. */
(()=> {
  'use strict';
  const $=id=>document.getElementById(id), canvas=$('game'), ctx=canvas.getContext('2d', {
    alpha:false
  });
  const W=1280,H=720,GROUND=576,CHUNK=960,METRE=8,BIOME=9600,CHECKPOINT=4800,STEP=1/120;
  const TAU=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
  const mod=(n,m)=>((n%m)+m)%m, smooth=t=>t*t*(3-2*t);
  const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const hash=n=> {
    n=Math.imul(n^(n>>>16),0x45d9f3b);
    n=Math.imul(n^(n>>>16),0x45d9f3b);
    return(n^(n>>>16))>>>0
  };
  function rng(seed) {
    let a=seed>>>0;
    return()=> {
      a+=0x6D2B79F5;
      let t=a;
      t=Math.imul(t^(t>>>15),t|1);
      t^=t+Math.imul(t^(t>>>7),t|61);
      return((t^(t>>>14))>>>0)/4294967296;
    };
  }
  const rand=(a,b)=>a+Math.random()*(b-a);
  let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const THEMES=[ {
    name:'Meadow of Dawn',top:'#d7e9fa',bottom:'#fff2de',mount:'#c9c8e7',hill:'#b8dfce',tree:'#a1cfb8',ground:'#eddbcd',edge:'#A8E6CF',accent:'#FF8B94',particle:'#fff8d2'
  }, {
    name:'Cotton Candy Clouds',top:'#e3d5f5',bottom:'#ffe1e3',mount:'#d9bdda',hill:'#d3c1ed',tree:'#e8bdd5',ground:'#e1d4ed',edge:'#f8edf9',accent:'#b894d6',particle:'#fff6d4'
  }, {
    name:'Sherbet Desert',top:'#bde5e9',bottom:'#ffead7',mount:'#edc5bb',hill:'#f0cfbc',tree:'#b5cfc0',ground:'#ecc1aa',edge:'#FFD3B6',accent:'#e59d96',particle:'#fff0d3'
  }, {
    name:'Twilight Glow Forest',top:'#777baf',bottom:'#cebedf',mount:'#9993bb',hill:'#9facbf',tree:'#839ea8',ground:'#bbb3d0',edge:'#b7dacf',accent:'#f5d3a3',particle:'#d6ffe8'
  } ];
  function mixColor(a,b,t) {
    const n=parseInt(a.slice(1),16),m=parseInt(b.slice(1),16);
    return`rgb(${Math.round(lerp(n>>16,m>>16,t))},${Math.round(lerp(n>>8&255,m>>8&255,t))},${Math.round(lerp(n&255,m&255,t))})`;
  }
  function themeAt(x) {
    const n=Math.floor(Math.max(0,x)/BIOME),a=THEMES[n%4],b=THEMES[(n+1)%4],f=smooth(clamp((mod(x,BIOME)/BIOME-.83)/.17,0,1)),out= {
      name:a.name
    };
    for(const k of ['top','bottom','mount','hill','tree','ground','edge','accent','particle'])out[k]=mixColor(a[k],b[k],f);
    return out;
  }
  function rounded(x,y,w,h,r,fill,stroke) {
    ctx.beginPath();
    ctx.roundRect(x,y,w,h,r);
    if(fill) {
      ctx.fillStyle=fill;
      ctx.fill();
    }
    if(stroke) {
      ctx.strokeStyle=stroke;
      ctx.stroke();
    }
  }
  function ellipse(x,y,rx,ry,color) {
    ctx.beginPath();
    ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);
    ctx.fillStyle=color;
    ctx.fill();
  }
  function star(x,y,r,color,rotation=0,points=4) {
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rotation);
    ctx.beginPath();
    for(let i=0;
    i<points*2;
    i++) {
      const a=i*Math.PI/points-Math.PI/2,rr=i%2?r*.42:r;
      ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);
    }
    ctx.closePath();
    ctx.fillStyle=color;
    ctx.fill();
    ctx.restore();
  }
  // Audio scheduling uses a lookahead clock, including envelopes to avoid clicks.
  class AudioEngine {
    constructor() {
      this.ctx=null;
      this.muted=false;
      this.beat=0;
      this.next=0;
      this.timer=null;
      this.scale=[0,4,7,11,14,11,7,4,2,5,9,12,16,12,9,5,0,4,7,12,16,14,11,7,-3,0,4,7,11,7,4,0];
    }
    unlock() {
      try {
        if(!this.ctx) {
          this.ctx=new(window.AudioContext||window.webkitAudioContext)();
          this.master=this.ctx.createGain();
          this.master.gain.value=this.muted?0:game.settings.sfx;
          const comp=this.ctx.createDynamicsCompressor();
          comp.threshold.value=-18;
          this.master.connect(comp);
          comp.connect(this.ctx.destination);
          this.next=this.ctx.currentTime+.12;
          this.timer=setInterval(()=>this.schedule(),70);
        }
        if(this.ctx.state==='suspended')this.ctx.resume().catch(()=> {
        });
      }catch {
      }
      soundtrack.start(this.ctx);
    }
    tone(freq,duration=.16,type='sine',gain=.15,at=0,endFreq=null,lowpass=null) {
      if(!this.ctx||this.muted)return;
      const t=at||this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type=type;
      o.frequency.setValueAtTime(freq,t);
      if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),t+duration);
      g.gain.setValueAtTime(.0001,t);
      g.gain.exponentialRampToValueAtTime(gain,t+.012);
      g.gain.exponentialRampToValueAtTime(.0001,t+duration);
      if(lowpass) {
        const filter=this.ctx.createBiquadFilter();
        filter.type='lowpass';
        filter.frequency.value=lowpass;
        o.connect(filter);
        filter.connect(g);
      }else o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t+duration+.02);
    }
    fx(kind) {
      if(!this.ctx)return;
      const t=this.ctx.currentTime;
      if(kind==='jump')this.tone(270,.17,'sine',.14,t,600);
      if(kind==='coin') {
        this.tone(880,.12,'sine',.12,t);
        this.tone(1320,.2,'sine',.09,t+.06);
      }
      if(kind==='stomp'||kind==='bump') {
        this.tone(kind==='stomp'?170:220,.15,'triangle',.18,t,60,650);
      }
      if(kind==='power'||kind==='checkpoint')[0,4,7,12].forEach((n,i)=>this.tone(440*2**(n/12),.4,'sine',.1,t+i*.085));
      if(kind==='hurt') {
        this.tone(260,.28,'triangle',.15,t,90);
        this.tone(190,.3,'sine',.06,t+.1,70);
      }
      if(kind==='dash')this.tone(650,.2,'triangle',.07,t,180);
    }
    schedule() {
      const mx=game.state==='MENU'?Math.floor(game.time/24)*BIOME:visualX();
      const transition=game.state==='MENU'?smooth(clamp((game.time%24-20)/4,0,1)):smooth(clamp((mod(mx,BIOME)/BIOME-.83)/.17,0,1));
      soundtrack.mix(Math.floor(mx/BIOME)%4,transition,this.muted,game.state==='PAUSED'||document.hidden,game.state==='PLAYING'?Math.min(1,Math.abs(game.player.vx)/400):0);

      if(!this.ctx||this.ctx.state!=='running')return;
      const t=this.ctx.currentTime;
      if(this.next<t)this.next=t+.05;
      while(this.next<t+.22) {
        const active=game.state==='PLAYING'&&game.deathTimer<=0;
        const tempo=active?76+Math.min(14,Math.abs(game.player.vx)/25):65;
        const dur=60/tempo/2;
        if(soundtrack.failed&&!this.muted&&game.state!=='PAUSED'&&!document.hidden) {
          const n=this.scale[this.beat%32],root=[261.63,293.66,261.63,220][Math.floor(Math.max(0,game.maxX)/BIOME)%4];
          if(this.beat%2===0||active)this.tone(root*2**(n/12),dur*1.65,'sine',active?.035:.023,this.next);
          if(this.beat%4===0) {
            this.tone(root/2*2**([0,5,7,0][Math.floor(this.beat/8)%4]/12),dur*3.5,'triangle',.035,this.next);
            this.tone(root*2,.05,'sine',.009,this.next);
          }
        }
        this.next+=dur;
        this.beat++;
      }
    }
    toggle() {
      this.muted=!this.muted;
      if(this.master)this.master.gain.setTargetAtTime(this.muted?0:game.settings.sfx,this.ctx.currentTime,.04);
      updateSound();
      try {
        localStorage.setItem('petalbound-muted',String(this.muted));
      }catch {
      }
    }
  }
  const audio=new AudioEngine();
  const soundtrack=new window.PetalSoundtrack(window.PetalAssets.music);
  const input= {
    left:false,right:false,jump:false,dash:false,buffer:0,dashPress:false
  };
  const keyMap= {
    ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'jump',KeyW:'jump',Space:'jump',ShiftLeft:'dash',ShiftRight:'dash'
  };
  const pad={left:false,right:false,jump:false,dash:false};
  const heldKeys=new Set(),touchPointers=new Map();
  function syncInput() {
    for(const k of ['left','right','jump','dash']) {
      const next=[...heldKeys].some(v=>keyMap[v]===k)||[...touchPointers.values()].includes(k)||pad[k];
      if(next&&!input[k]) {
        if(k==='jump')input.buffer=.13;
        if(k==='dash')input.dashPress=true;
      }
      input[k]=next;
    }
  }
  function clearInput() {
    heldKeys.clear();
    touchPointers.clear();
    input.left=input.right=input.jump=input.dash=input.dashPress=false;
    input.buffer=0;
    document.querySelectorAll('.touch-btn').forEach(b=>b.classList.remove('down'));
  }
  window.addEventListener('keydown',e=> {
    if(keyMap[e.code]) {
      e.preventDefault();
      heldKeys.add(e.code);
      syncInput();
    }
    if(e.repeat)return;
    if(e.code==='Enter'&&game.state==='MENU'&&$('help').hidden&&$('settings').hidden)start();
    if(e.code==='KeyR'&&$('help').hidden&&$('settings').hidden&&game.state!=='MENU')start();
    if((e.code==='KeyP'||e.code==='Escape')&&$('help').hidden&&$('settings').hidden)togglePause();
    if(e.code==='Escape'&&!$('help').hidden)closeHelp();
    if(e.code==='Escape'&&!$('settings').hidden)closeSettings();
    if(e.code==='KeyM') {
      audio.unlock();
      audio.toggle();
    }
    if(e.code==='KeyF')fullscreen();
  });
  window.addEventListener('keyup',e=> {
    if(keyMap[e.code]) {
      e.preventDefault();
      heldKeys.delete(e.code);
      syncInput();
    }
  });
  for(const button of document.querySelectorAll('[data-control]')) {
    button.addEventListener('pointerdown',e=> {
      e.preventDefault();
      audio.unlock();
      button.setPointerCapture(e.pointerId);
      touchPointers.set(e.pointerId,button.dataset.control);
      button.classList.add('down');
      syncInput();
    });
    const release=e=> {
      touchPointers.delete(e.pointerId);
      if(![...touchPointers.values()].includes(button.dataset.control))button.classList.remove('down');
      syncInput();
    };
    button.addEventListener('pointerup',release);
    button.addEventListener('pointercancel',release);
    button.addEventListener('lostpointercapture',release);
  }
  // Pattern dimensions never exceed an unpowered jump's reach. Each chunk has
  // a safe entrance and exit; checkpoint chunks have an uninterrupted floor.
  class World {
    constructor(seed) {
      this.seed=seed;
      this.chunks=new Map();
      this.blocks=[];
      this.platforms=[];
      this.pickups=[];
      this.enemies=[];
      this.decor=[];
      this.generated=-1;
    }
    generate(index) {
      if(index<0||this.chunks.has(index))return;
      const random=rng(hash(this.seed+index*971)),x=index*CHUNK,biome=Math.floor(Math.min(x,game.mode==='story'?BIOME*4-1:Infinity)/BIOME)%4,difficulty=Math.min(6,Math.floor(x/(BIOME*2))),checkpoint=index%5===0;
      const c= {
        index,x,ground:[],blocks:[],platforms:[],pickups:[],enemies:[],decor:[],checkpoint
      };
      const ground=(a,w)=>c.ground.push( {
        x:x+a,y:GROUND,w,h:300,type:'ground'
      });
      const platform=(a,y,w,type='platform')=>c.platforms.push( {
        x:x+a,baseX:x+a,y,baseY:y,w,h:18,type,sink:0,touched:false
      });
      const coin=(a,y,type='coin')=>c.pickups.push( {
        x:x+a,y,baseY:y,w:20,h:24,type,phase:random()*TAU,dead:false
      });
      const block=(a,y,type,reward='coin')=>c.blocks.push( {
        x:x+a,y,w:44,h:44,type,reward,used:false,bump:0,dead:false
      });
      const enemy=(a,type='blob',y=GROUND)=> {
        if(index===0)return;
        c.enemies.push( {
          x:x+a,y:y-(type==='flutter'?26:27),baseX:x+a,baseY:y-27,w:type==='flutter'?32:31,h:27,type,vx:(random()<.5?-1:1)*(29+difficulty*5),left:x+a-60,right:x+a+65,t:random()*TAU,dead:false,squish:0
        });
      };
      const script=[[0,1,2,4,3,0,5,6,7,8],[0,6,2,7,5,0,8,3,1,6],[0,7,5,3,8,0,1,6,2,4],[0,8,6,4,2,0,7,5,3,8]][biome];
      const pattern=checkpoint?0:game.mode==='story'?script[index%10]:1+Math.floor(random()*8);
      if(pattern===0) {
        ground(0,CHUNK);
        platform(430,464,130,biome===1?'bounce':'platform');
        for(let i=0;
        i<5;
        i++)coin(440+i*26,420-Math.sin(i/4*Math.PI)*30);
        block(245,429,'prize',index===0?'lotus':index%10===0?'star':'lotus');
        block(289,429,'brick');
        if(index>0) {
          block(333,429,'prize','star');
          enemy(760);
        }
      }
      if(pattern===1) {
        ground(0,430);
        ground(540,420);
        platform(400,490,170,biome===1?'bounce':biome===2?'sand':'platform');
        for(let i=0;
        i<7;
        i++)coin(350+i*42,430-Math.sin(i/6*Math.PI)*60);
        block(220,429,'prize',index%3===0?'lotus':'coin');
        enemy(740,random()<.35?'spike':'blob');
      }
      if(pattern===2) {
        ground(0,CHUNK);
        platform(210,474,120,biome===1?'bounce':'platform');
        platform(380,378,120);
        platform(560,452,130,biome===2?'sand':'platform');
        coin(422,330,'gem');
        for(let i=0;
        i<4;
        i++)coin(575+i*28,415);
        block(720,427,'prize','star');
        enemy(480);
        enemy(800,biome===3?'flutter':'blob',biome===3?455:GROUND);
      }
      if(pattern===3) {
        ground(0,350);
        ground(455,245);
        ground(800,160);
        platform(323,489,150,biome===1?'bounce':'platform');
        platform(676,490,150,biome===2?'sand':'platform');
        for(let i=0;
        i<4;
        i++) {
          coin(330+i*33,449-Math.sin(i/3*Math.PI)*25);
          coin(686+i*33,449-Math.sin(i/3*Math.PI)*25);
        }
        block(550,425,'prize','lotus');
        coin(597,370,'gem');
      }
      if(pattern===4) {
        ground(0,CHUNK);
        for(let i=0;
        i<4;
        i++) {
          block(330+i*44,430,i===1?'prize':'brick',i===1?(index%2?'lotus':'star'):'coin');
          coin(342+i*44,383);
        }
        enemy(610,'blob');
        enemy(790,random()<.5?'spike':'blob');
        platform(680,460,110,biome===1?'bounce':'platform');
      }
      if(pattern===5) {
        ground(0,440);
        ground(550,410);
        platform(275,474,120);
        platform(445,392,120,biome===1?'bounce':'platform');
        platform(620,472,120,biome===2?'sand':'platform');
        for(let i=0;
        i<3;
        i++)coin(460+i*31,350);
        coin(662,430,'gem');
        enemy(780);
        if(index>3)enemy(490,'flutter',330);
        block(160,428,'prize','lotus');
      }

      if(pattern===6){
        ground(0,CHUNK);platform(180,474,130);platform(375,389,130,'drift');platform(615,465,145);
        for(let i=0;i<5;i++)coin(390+i*26,345);coin(672,420,'gem');
        block(780,426,'prize','star');enemy(470,'flutter',460);
      }
      if(pattern===7){
        ground(0,370);ground(480,480);platform(320,489,200,biome===1?'bounce':'platform');
        platform(600,473,110);platform(780,386,120);coin(827,335,'gem');
        for(let i=0;i<6;i++)coin(330+i*35,430-Math.sin(i/5*Math.PI)*35);
        enemy(675,'spike');block(180,428,'prize','lotus');
      }
      if(pattern===8){
        ground(0,CHUNK);platform(205,472,135);platform(395,375,140);platform(620,464,130,'drift');
        for(let i=0;i<4;i++){coin(410+i*30,330);block(390+i*44,463,i===2?'prize':'brick',i===2?'star':'coin');}
        enemy(760,'blob');enemy(840,'spike');coin(680,416,'gem');
      }
      const relicSlot=[2,5,8].indexOf(index%10);
      if(relicSlot>=0){
        const id=Math.floor(index/10)*3+relicSlot;
        platform(755,470,145);
        c.pickups.push({x:x+815,y:416,baseY:416,w:24,h:28,type:'relic',phase:random()*TAU,id,dead:game.relics.has(id)});
      }
      if(game.mode==='story'&&index>=40){
        c.ground=[{x,y:GROUND,w:CHUNK,h:300,type:'ground'}];
        c.platforms=[];c.blocks=[];c.pickups=[];c.enemies=[];
        if(index===40){coin(220,GROUND-44,'lotus');coin(330,GROUND-44,'star');}
      }

      if(biome===1&&!checkpoint) {
        for(const p of c.platforms)if(p.type==='platform')p.type='rainbow';
      }
      if(difficulty>0&&!checkpoint&&pattern!==3&&(game.mode!=='story'||index<40))enemy(155,difficulty>2&&random()<.5?'spike':'blob');
      // Scenery sits only on solid ground so it doubles as a readable edge cue.
      for(const g of c.ground) {
        for(let a=g.x+22;
        a<g.x+g.w-20;
        a+=38+random()*54)c.decor.push( {
          x:a,y:GROUND,kind:random(),size:.6+random()*.8,phase:random()*TAU,biome
        });
      }
      if(checkpoint&&index>0)c.shrine= {
        x:x+85,y:GROUND
      };
      this.chunks.set(index,c);
      this.generated=Math.max(this.generated,index);
      this.refresh();
    }
    refresh() {
      const chunks=[...this.chunks.values()];
      this.blocks=chunks.flatMap(c=>c.blocks);
      this.platforms=chunks.flatMap(c=>c.platforms);
      this.pickups=chunks.flatMap(c=>c.pickups);
      this.enemies=chunks.flatMap(c=>c.enemies);
      this.decor=chunks.flatMap(c=>c.decor);
    }
    stream(x,checkpoint) {
      const n=Math.floor(x/CHUNK);
      for(let i=Math.max(0,n-1);
      i<=n+3;
      i++)this.generate(i);
      let changed=false;
      const oldest=Math.floor(checkpoint/CHUNK)-1;
      for(const k of this.chunks.keys())if(k<oldest||k>n+6) {
        this.chunks.delete(k);
        changed=true;
      }
      if(changed)this.refresh();
    }
    solids() {
      return[...[...this.chunks.values()].flatMap(c=>c.ground),...this.platforms.filter(p=>p.y<800),...this.blocks.filter(b=>!b.dead)];
    }
  }
  class Player {
    constructor(x=110,y=GROUND-44) {
      this.x=x;
      this.y=y;
      this.w=34;
      this.h=44;
      this.vx=0;
      this.vy=0;
      this.big=false;
      this.flight=0;
      this.facing=1;
      this.grounded=false;
      this.coyote=0;
      this.airJump=true;
      this.dash=0;
      this.dashCooldown=0;
      this.invincible=1.8;
      this.squash=0;
      this.walk=0;
      this.trailTimer=0;
    }
    setBig(big) {
      if(big===this.big)return true;
      const w=big?52:34,h=big?68:44;
      const next= {
        x:this.x+(this.w-w)/2,y:this.y+this.h-h,w,h
      };
      if(big&&game.world.solids().some(s=>overlap(next,s)&&s.type!=='ground'))return false;
      Object.assign(this,next);
      this.big=big;
      return true;
    }
    update(dt) {
      const wasGround=this.grounded,oldY=this.y,oldBottom=this.y+this.h;
      this.coyote=wasGround?.085:Math.max(0,this.coyote-dt);
      this.invincible=Math.max(0,this.invincible-dt);
      this.flight=Math.max(0,this.flight-dt);
      this.dashCooldown=Math.max(0,this.dashCooldown-dt);
      this.dash=Math.max(0,this.dash-dt);
      this.squash=lerp(this.squash,0,dt*12);
      input.buffer=Math.max(0,input.buffer-dt);
      const direction=(input.right?1:0)-(input.left?1:0),speed=input.dash?392:272;
      if(direction)this.facing=direction;
      const accel=wasGround?1900:1250;
      if(this.dash<=0) {
        if(direction)this.vx=clamp(this.vx+direction*accel*dt,-speed,speed);
        else this.vx*=Math.exp(-(wasGround?13:2.2)*dt);
      }else this.vx=this.facing*610;
      if(input.dashPress&&(this.big||this.flight>0||game.maxX>=CHECKPOINT)&&this.dashCooldown<=0) {
        this.dash=.19;
        this.dashCooldown=.8;
        this.vy=Math.min(this.vy,0);
        audio.fx('dash');
        burst(this.x+this.w/2,this.y+this.h/2,'#DED2F9',12,130);
      }
      input.dashPress=false;
      if(input.buffer>0&&(this.coyote>0||wasGround||(this.flight>0||game.maxX>=BIOME)&&this.airJump)) {
        const extra=!(this.coyote>0||wasGround);
        this.vy=extra?-510:-635;
        this.coyote=0;
        this.grounded=false;
        if(extra)this.airJump=false;
        input.buffer=0;
        this.squash=-.16;
        audio.fx('jump');
        burst(this.x+this.w/2,this.y+this.h,extra?'#DED2F9':'#fff8e8',8,60);
      }
      let gravity=this.vy<0?(input.jump?1530:3300):1900;
      if((this.flight>0||game.maxX>=BIOME*2)&&input.jump&&this.vy>0)gravity=200;
      this.vy=Math.min(this.vy+gravity*dt,(this.flight>0||game.maxX>=BIOME*2)&&input.jump?95:780);
      if(this.dash>0)this.vy*=.9;
      // Blocks are full solids. Platforms and terrain have one-way top surfaces.
      this.x=Math.max(0,this.x+this.vx*dt);
      const solids=game.world.solids();
      for(const b of game.world.blocks) {
        if(b.dead||!overlap(this,b))continue;
        if(oldBottom>b.y+4&&oldY<b.y+b.h-4) {
          if(this.vx>0)this.x=b.x-this.w;
          else if(this.vx<0)this.x=b.x+b.w;
          this.vx=0;
        }
      }
      this.y+=this.vy*dt;
      this.grounded=false;
      let landing=null;
      for(const s of solids) {
        if(this.x+this.w<=s.x+1||this.x>=s.x+s.w-1)continue;
        if(this.vy>=0&&oldBottom<=s.y+5&&this.y+this.h>=s.y) {
          if(!landing||s.y<landing.y)landing=s;
        }else if(s.w===44&&this.vy<0&&oldY>=s.y+s.h-3&&this.y<=s.y+s.h&&this.y+this.h>s.y) {
          this.y=s.y+s.h;
          this.vy=75;
          hitBlock(s,this.big);
        }
      }
      if(landing) {
        this.y=landing.y-this.h;
        this.vy=0;
        this.grounded=true;
        this.airJump=true;
        if(!wasGround) {
          this.squash=.23;
          burst(this.x+this.w/2,landing.y,'#fff6e6',7,55);
        }
        if(landing.type==='bounce') {
          this.vy=input.jump?-790:-690;
          this.grounded=false;
          this.coyote=0;
          this.squash=-.2;
          landing.sink=.7;
          audio.fx('jump');
          burst(this.x+this.w/2,landing.y,'#fff6ff',14,100);
        }
        if(landing.type==='sand')landing.touched=true;
      }
      this.walk+=Math.abs(this.vx)*dt*.055;
      this.trailTimer-=dt;
      if(this.trailTimer<=0&&(this.flight>0||this.dash>0)) {
        this.trailTimer=.055;
        burst(this.x+this.w/2,this.y+this.h*.7,this.dash>0?'#FFD3B6':'#DED2F9',2,25);
      }
      for(const c of game.world.pickups) {
        if(c.dead)continue;
        const box= {
          x:c.x-5,y:c.y-8,w:c.w+10,h:c.h+16
        };
        if(overlap(this,box))collect(c);
      }
      for(const e of game.world.enemies) {
        if(e.dead||!overlap(this,e))continue;
        if(this.dash>0&&(this.big||this.flight>0||game.maxX>=CHECKPOINT)) {
          defeat(e);
          continue;
        }
        if(e.type!=='spike'&&this.vy>0&&oldBottom<=e.y+13) {
          defeat(e);
          this.vy=input.jump?-440:-350;
          this.airJump=true;
          this.squash=.2;
        }else hurt();
      }
      if(this.y>H+160)die();
    }
  }
  const game= {
    state:'MENU',mode:'story',settings:readPreferences(),relics:new Set(),ghosts:[],pulses:[],hitstop:0,boss:null,companion:{x:100,y:500},world:null,player:null,seed:0,time:0,playtime:0,camera:0,camY:0,maxX:0,score:0,coins:0,lives:3,best:0,bestScore:0,runStartBest:0,checkpoint:0,nextCheckpoint:CHECKPOINT,season:0,particles:[],popups:[],deathTimer:0,shake:0,flash:0,lastBiome:0,toastTimer:0,newBest:false,renderCount:0
  };
  try {
    game.best=Number(localStorage.getItem('petalbound-best'))||0;
    game.bestScore=Number(localStorage.getItem('petalbound-score'))||0;
    audio.muted=localStorage.getItem('petalbound-muted')==='true';
  }catch {
  }
  let savedStory=readSavedStory();
  reduced=game.settings.reducedMotion;
  soundtrack.volume=game.settings.music;
  const art=new window.PetalArt(ctx,window.PetalAssets,{game,ellipse,rounded,star,cloud,hash,mod,clamp,smooth,mixColor,viewWidth:()=>viewW});
  game.world=new World(713);
  game.world.stream(0,0);
  game.player=new Player();
  function burst(x,y,color,n=12,speed=120) {
    for(let i=0;
    i<n;
    i++) {
      if(game.particles.length>=280)game.particles.shift();
      const a=rand(-Math.PI,Math.PI),v=rand(speed*.3,speed);
      game.particles.push( {
        x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-25,life:rand(.3,.7),max:.7,size:rand(2,6),rotation:rand(0,TAU),color,star:i%3===0
      });
    }
  }
  function popup(x,y,text,color='#7f657f') {
    game.popups.push( {
      x,y,text,color,life:1.2
    });
    if(game.popups.length>20)game.popups.shift();
  }
  function toast(title,subtitle,duration=4) {
    $('toast').innerHTML='';
    const b=document.createElement('b');
    b.textContent=title;
    $('toast').append(b,document.createTextNode(subtitle));
    $('toast').classList.add('show');
    game.toastTimer=duration;
    $('announcer').textContent=title+'. '+subtitle;
  }
  function saveBest() {
    const distance=Math.max(0,Math.floor((game.maxX-110)/METRE));
    game.newBest=distance>game.runStartBest;
    game.best=Math.max(game.best,distance);
    game.bestScore=Math.max(game.bestScore,game.score);
    try {
      localStorage.setItem('petalbound-best',String(game.best));
      localStorage.setItem('petalbound-score',String(game.bestScore));
    }catch {
    }
    $('menuBest').textContent=game.best.toLocaleString()+' m';
    $('menuBestScore').textContent=game.bestScore.toLocaleString();
    saveStory();refreshContinue();
  }
  function setState(state) {
    game.state=state;
    $('frame').dataset.state=state;
    for(const [id,s]of[['menu','MENU'],['pause','PAUSED'],['gameover','GAMEOVER'],['victory','VICTORY']])$(id).hidden=state!==s;
    const active=state==='PLAYING'||state==='PAUSED';
    $('hud').hidden=!active;
    $('biomeHud').hidden=!active;
    $('pauseButton').hidden=!active;
    $('logo').hidden=state!=='MENU';
    $('touch').classList.toggle('active',state==='PLAYING');
    $('landscape').classList.toggle('playing',state==='PLAYING');
    if(state==='PAUSED')soundtrack.pause();
    else if(soundtrack.started)soundtrack.start();
    $('bossHud').hidden=state!=='PLAYING'||!game.boss?.active;
    clearInput();
  }
  function start(mode=game.mode||'story'){
    if(typeof mode!=='string')mode=game.mode||'story';
    audio.unlock();saveBest();
    game.mode=mode;game.seed=mode==='story'?0x50455441:hash(Date.now());
    game.relics=new Set();game.world=new World(game.seed);game.player=new Player();
    Object.assign(game,{camera:0,camY:0,maxX:110,score:0,coins:0,lives:3,checkpoint:0,nextCheckpoint:CHECKPOINT,season:0,particles:[],popups:[],ghosts:[],pulses:[],deathTimer:0,shake:0,flash:0,lastBiome:0,playtime:0,runStartBest:game.best,hitstop:0,companion:{x:90,y:480},boss:makeKeeper()});
    game.world.stream(0,0);$('help').hidden=true;$('settings').hidden=true;setState('PLAYING');
    if(mode==='story'){savedStory=null;try{localStorage.removeItem('petalbound-deluxe-story');}catch{}refreshContinue();}
    toast(mode==='story'?'I · Beneath the morning boughs':'An endless little wonder',mode==='story'?'Three memory petals hide in each realm. Follow the light.':'New patterns. New skies. See how far you bloom.',5);
    canvas.focus({preventScroll:true});
  }

  function togglePause() {
    audio.unlock();
    if(game.state==='PLAYING'&&game.deathTimer<=0) {
      setState('PAUSED');
      saveBest();
    }else if(game.state==='PAUSED')setState('PLAYING');
  }
  function collect(c) {
    if(c.dead)return;
    if(c.type==='relic'){
      c.dead=true;if(game.relics.has(c.id))return;game.relics.add(c.id);game.score+=1000;
      burst(c.x+12,c.y+14,'#ffe9b9',30,170);popup(c.x,c.y,'Memory petal · +1,000');
      game.pulses.push({x:c.x+12,y:c.y+14,r:3,life:.8});audio.fx('power');
      toast('A memory, gathered.',game.mode==='story'?game.relics.size+' / 12 petals · a little piece of this world':game.relics.size+' memory petals collected',3);
      return;
    }
    if(c.type==='lotus'&&!game.player.setBig(true))return;
    c.dead=true;
    const p=game.player;
    if(c.type==='coin') {
      game.coins++;
      game.score+=100;
      audio.fx('coin');
      if(game.coins%50===0) {
        game.lives=Math.min(5,game.lives+1);
        toast('A little extra life.','50 stardust collected · keep blooming',3);
        audio.fx('power');
      }
    }else if(c.type==='gem') {
      game.score+=500;
      audio.fx('coin');
      popup(c.x,c.y,'+500');
    }else {
      game.score+=250;
      if(c.type==='star') {
        p.flight=25;
        p.airJump=true;
        toast('Starfall spirit','Jump again in the air · hold jump to float',4);
      }else toast('Blossom form','You grew! Break bricks · dash through critters',4);
      audio.fx('power');
      p.invincible=Math.max(p.invincible,.8);
    }
    burst(c.x+10,c.y+10,c.type==='coin'?'#FFF1A8':c.type==='lotus'?'#FF8B94':'#DED2F9',16,125);
  }
  function hitBlock(b,big) {
    if(b.dead)return;
    b.bump=.23;
    if(b.type==='prize'&&!b.used) {
      b.used=true;
      audio.fx('bump');
      if(b.reward==='coin') {
        game.coins++;
        game.score+=100;
        if(game.coins%50===0) {
          game.lives=Math.min(5,game.lives+1);
          toast('A little extra life.','50 stardust collected',3);
        }
        burst(b.x+22,b.y-14,'#FFF1A8',15,115);
        popup(b.x+22,b.y-20,'+100');
        audio.fx('coin');
      }else {
        const c= {
          x:b.x+10,y:b.y-28,baseY:b.y-28,w:24,h:26,type:b.reward,phase:0,dead:false,emerge:.55
        };
        game.world.chunks.get(Math.floor(b.x/CHUNK)).pickups.push(c);
        game.world.refresh();
        burst(b.x+22,b.y,'#fff6e8',10,80);
      }
    }else if(b.type==='brick'&&big) {
      b.dead=true;
      game.score+=50;
      audio.fx('stomp');
      burst(b.x+22,b.y+22,'#e0b9c5',20,170);
    }else audio.fx('bump');
  }
  function defeat(e) {
    game.hitstop=.045;game.pulses.push({x:e.x+15,y:e.y+15,r:4,life:.4});
    e.dead=true;
    e.squish=.35;
    game.score+=200;
    audio.fx('stomp');
    popup(e.x+15,e.y,'+200');
    burst(e.x+15,e.y+15,e.type==='flutter'?'#DED2F9':'#FFD3B6',12,105);
  }
  function hurt() {
    const p=game.player;
    if(p.invincible>0||game.deathTimer>0)return;
    if(p.big||p.flight>0) {
      p.setBig(false);
      p.flight=0;
      p.invincible=2.3;
      p.vy=-280;
      p.vx=-p.facing*150;
      game.shake=.18;
      audio.fx('hurt');
      burst(p.x,p.y,'#FF8B94',16,130);
    }else die();
  }
  function die() {
    if(game.deathTimer>0||game.state!=='PLAYING')return;
    game.deathTimer=1.25;
    game.lives--;
    audio.fx('hurt');
    game.shake=.3;
    burst(game.player.x,Math.min(H,game.player.y),'#FF8B94',22,160);
    saveBest();
  }
  function finishDeath() {
    if(game.lives<=0) {
      saveBest();
      $('resultDistance').textContent=Math.floor((game.maxX-110)/METRE).toLocaleString()+' m';
      $('resultScore').textContent=game.score.toLocaleString();
      $('resultBest').textContent=game.best.toLocaleString()+' m';
      $('resultEyebrow').textContent=game.newBest?'A new personal best':'Every ending is a seed';
      $('resultMessage').textContent=game.newBest?'You wandered a little farther than ever before.':'There’s always another path waiting to bloom.';
      setState('GAMEOVER');
    }else {
      const x=game.checkpoint>0?game.checkpoint+115:110;
      game.player=new Player(x);
      game.camera=Math.max(0,x-viewW*.28);
      game.camY=0;
      game.world.stream(x,game.checkpoint);
      clearInput();
      toast('A fresh little breath.',game.checkpoint>0?'Back at your checkpoint garden':'The meadow is waiting for you',2.6);
    }
  }
  function updateEffects(dt) {
    for(const part of game.particles) {
      part.life-=dt;
      part.x+=part.vx*dt;
      part.y+=part.vy*dt;
      part.vy+=190*dt;
      part.rotation+=dt*2;
    }
    game.particles=game.particles.filter(p=>p.life>0);
    for(const text of game.popups) {
      text.life-=dt;
      text.y-=28*dt;
    }
    game.popups=game.popups.filter(p=>p.life>0);
  }
  function update(dt) {
    game.time+=dt;
    if(game.toastTimer>0) {
      game.toastTimer-=dt;
      if(game.toastTimer<=0)$('toast').classList.remove('show');
    }
    if(game.state!=='PLAYING')return;
    game.playtime+=dt;
    for(const ghost of game.ghosts)ghost.life-=dt;game.ghosts=game.ghosts.filter(g=>g.life>0);
    for(const pulse of game.pulses){pulse.life-=dt;pulse.r+=dt*170;}game.pulses=game.pulses.filter(p=>p.life>0);
    if(game.hitstop>0){game.hitstop-=dt;updateEffects(dt);return;}
    updateEffects(dt);
    game.shake=Math.max(0,game.shake-dt);
    if(game.deathTimer>0) {
      game.deathTimer-=dt;
      if(game.deathTimer<=0)finishDeath();
      return;
    }
    const p=game.player;
    game.world.stream(p.x,game.checkpoint);
    const previousBottom=p.y+p.h;
    updateDrifters(dt);
    p.update(dt);
    updateDeluxe(dt,previousBottom);
    if(game.state!=='PLAYING')return;
    game.maxX=Math.max(game.maxX,p.x);
    for(const b of game.world.blocks)b.bump=Math.max(0,b.bump-dt);
    for(const platform of game.world.platforms) {
      if(platform.type==='sand') {
        if(platform.touched) {
          platform.sink=Math.min(120,platform.sink+dt*30);
          platform.touched=false;
        }else platform.sink=Math.max(0,platform.sink-dt*9);
        platform.y=platform.baseY+platform.sink;
      }else platform.sink=Math.max(0,platform.sink-dt*2);
    }
    for(const c of game.world.pickups)if(c.emerge)c.emerge=Math.max(0,c.emerge-dt);
    for(const e of game.world.enemies) {
      e.squish=Math.max(0,e.squish-dt);
      if(e.dead||Math.abs(e.x-p.x)>viewW+CHUNK)continue;
      e.t+=dt;
      if(e.type==='flutter') {
        e.x=e.baseX+Math.sin(e.t*1.7)*64;
        e.y=e.baseY+Math.sin(e.t*2.4)*42;
      }else {
        const next=e.x+e.vx*dt,solids=game.world.solids(),ahead=e.vx>0?next+e.w+7:next-7,hasFloor=solids.some(s=>ahead>=s.x&&ahead<s.x+s.w&&Math.abs(s.y-(e.y+e.h))<8);
        if(next<e.left||next>e.right||!hasFloor)e.vx=-e.vx;
        else e.x=next;
      }
    }
    if(p.x>=game.nextCheckpoint+110) {
      game.checkpoint=game.nextCheckpoint;
      game.nextCheckpoint+=CHECKPOINT;
      game.score+=1000;
      game.lives=Math.min(5,game.lives+1);
      audio.fx('checkpoint');
      saveBest();
      burst(p.x,GROUND-65,'#FFF1A8',35,200);
      if(game.mode==='story'&&game.checkpoint===BIOME*4){toast('The last garden. The final light.','Awaken the Moonkeeper · step into the moonlit clearing',5);}
      else if(game.checkpoint%(BIOME*4)===0) {
        game.season++;
        toast('A whole world, beautifully wandered.','Season '+(game.season+1)+' begins · +1 life · +1,000 points',6);
      }else toast(game.checkpoint===CHECKPOINT?'Petal dash awakened':'Checkpoint garden',game.checkpoint===CHECKPOINT?'Tap Shift or DASH to burst through danger':'Story saved · +1 life · +1,000 points',4);
    }
    const bn=Math.floor(visualX()/BIOME);
    if(bn!==game.lastBiome) {
      game.lastBiome=bn;
      toast(['I · Beneath the morning boughs','II · Where the sky remembers','III · The sea beneath the sand','IV · The forest of a thousand lights'][bn%4],['Follow the light.','Double jump awakened · press jump again in the air','Leaf glide awakened · hold jump while falling','The Moonkeeper waits beyond the last garden.'][bn%4],5);audio.fx('checkpoint');
    }
    game.camera=lerp(game.camera,Math.max(0,p.x-viewW*(viewW<850?.32:.32)),1-Math.exp(-dt*6));
    game.camY=lerp(game.camY,clamp((p.y-385)*.17,-85,5),1-Math.exp(-dt*3));
    game.flash=Math.max(0,game.flash-dt);
  }
  // Rendering is drawn in view units with a device-pixel-ratio cap for phones.
  let viewW=W,scale=1,dpr=1;
  function resize() {
    const rect=$('frame').getBoundingClientRect();
    dpr=Math.min(game.settings.quality==='low'?1:2,window.devicePixelRatio||1);
    canvas.width=Math.round(rect.width*dpr);
    canvas.height=Math.round(rect.height*dpr);
    scale=rect.height/H;
    viewW=rect.width/scale;
  }
  window.addEventListener('resize',resize);
  resize();
  /* Procedural illustration helpers and layered world renderer. */
  function cloud(x,y,s=1,alpha=.8) {
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.translate(x,y);
    ctx.scale(s,s);
    ctx.fillStyle='#fffaf6';
    ctx.beginPath();
    ctx.moveTo(-67,13);
    ctx.bezierCurveTo(-91,3,-79,-26,-53,-24);
    ctx.bezierCurveTo(-55,-55,-11,-67,8,-39);
    ctx.bezierCurveTo(35,-59,66,-37,61,-15);
    ctx.bezierCurveTo(94,-18,101,15,74,20);
    ctx.bezierCurveTo(35,29,-25,24,-67,13);
    ctx.fill();
    ctx.restore();
  }
  function flower(x,y,s,t,color='#fff7e4') {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(s,s);
    const sway=Math.sin(t*1.6+x)*2;
    ctx.strokeStyle='#81ac93';
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.quadraticCurveTo(sway, -10,sway,-24);
    ctx.stroke();
    ellipse(4,-10,5,2,'#9cc3a7');
    for(let i=0;
    i<5;
    i++) {
      const a=i*TAU/5;
      ellipse(sway+Math.cos(a)*5,-24+Math.sin(a)*5,4,4,color);
    }
    ellipse(sway,-24,3,3,'#ead490');
    ctx.restore();
  }
  function mushroom(x,y,s,t,color='#dca2b7'){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s*(1+Math.sin(t*2+x)*.025));
    const stem=ctx.createLinearGradient(-5,0,6,0);stem.addColorStop(0,'#c9baa1');stem.addColorStop(.5,'#f4e6c7');stem.addColorStop(1,'#dfcab2');rounded(-5,-23,10,25,5,stem);
    ellipse(0,-17,23,7,'#b08b9f');ctx.strokeStyle='#e7cad0';ctx.lineWidth=.6;
    for(let i=-18;i<=18;i+=5){ctx.beginPath();ctx.moveTo(i,-17);ctx.lineTo(i*.25,-12);ctx.stroke();}
    const cap=ctx.createRadialGradient(-8,-36,1,0,-24,32);cap.addColorStop(0,'#f8d7dc');cap.addColorStop(.5,color);cap.addColorStop(1,'#a97896');
    ctx.beginPath();ctx.moveTo(-24,-19);ctx.bezierCurveTo(-23,-51,23,-51,24,-19);ctx.quadraticCurveTo(0,-12,-24,-19);ctx.fillStyle=cap;ctx.fill();
    ellipse(-10,-29,4,2.7,'#fff0d9');ellipse(8,-26,5,2.7,'#ffedd5');ellipse(1,-37,3,1.8,'#fff6e2');
    ctx.strokeStyle='#ffe9de7a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-19,-27);ctx.quadraticCurveTo(-9,-45,8,-39);ctx.stroke();ctx.restore();
  }
  function lantern(x,y,s,t) {
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(Math.sin(t+x)*.06);
    ctx.scale(s,s);
    ctx.strokeStyle='#8b799d';
    ctx.lineWidth=1.2;
    ctx.beginPath();
    ctx.moveTo(0,-80);
    ctx.quadraticCurveTo(9,-60,0,-34);
    ctx.stroke();
    const light=ctx.createRadialGradient(0,-19,1,0,-19,42);
    light.addColorStop(0,'#fff1b34a');
    light.addColorStop(1,'#fff1b300');
    ellipse(0,-19,42,42,light);
    rounded(-10,-32,20,27,8,'#ffedb8');
    ctx.strokeStyle='#c2a7ad';
    ctx.beginPath();
    ctx.moveTo(-4,-30);
    ctx.lineTo(-4,-7);
    ctx.moveTo(4,-30);
    ctx.lineTo(4,-7);
    ctx.stroke();
    rounded(-9,-35,18,4,2,'#a78da9');
    ctx.restore();
  }
  function tree(x,y,s,color,t,biome=0) {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(s,s);
    ctx.strokeStyle=biome===3?'#8c839f':'#b5aa9c';
    ctx.lineWidth=9;
    ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.quadraticCurveTo(-8,-54,0,-107);
    ctx.moveTo(-1,-42);
    ctx.lineTo(-24,-73);
    ctx.moveTo(-1,-64);
    ctx.lineTo(25,-89);
    ctx.stroke();
    const sway=Math.sin(t*.5+x)*2;
    ellipse(sway,-105,49,43,color);
    ellipse(-30+sway,-84,34,32,color);
    ellipse(29+sway,-92,32,36,color);
    ellipse(-10+sway,-122,30,25,color);
    ctx.globalAlpha=.17;
    ellipse(-17+sway,-121,26,15,'#ffffff');
    ctx.restore();
  }
  function drawBackground(cam,theme,t){art.background(cam,t,visualX(),viewW,theme,game.state==='MENU');}

  function drawGround(g,theme,t){art.terrain(g,visualX(),t);}

  function drawPlatform(p,theme,t) {
    if(p.type!=='bounce'){drawLeafPlatform(p,t);return;}
    const x=p.x,y=p.y;
    if(p.type==='bounce') {
      cloud(x+p.w/2,y+7,p.w/165,.95);
      ellipse(x+p.w*.43,y+1,2,3,'#9e85b1');
      ellipse(x+p.w*.57,y+1,2,3,'#9e85b1');
      ctx.strokeStyle='#b49abd';
      ctx.beginPath();
      ctx.arc(x+p.w/2,y+3,4,0,Math.PI);
      ctx.stroke();
      if(p.sink>0) {
        ctx.globalAlpha=p.sink;
        star(x+12,y-15,7,'#fff7db',t);
        ctx.globalAlpha=1;
      }
    }else {
      rounded(x,y+4,p.w,p.h+6,8,p.type==='sand'?'#e7b8aa':'#d8c6df');
      rounded(x,y,p.w,p.h,8,p.type==='sand'?'#FFD3B6':theme.edge);
      if(p.type==='rainbow') {
        const colors=['#FFB9C7','#FFD3B6','#FFF1A8','#A8E6CF','#BAE1FF','#DED2F9'];
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x,y,p.w,16,8);
        ctx.clip();
        colors.forEach((c,i)=> {
          ctx.fillStyle=c;
          ctx.fillRect(x+p.w*i/6,y,p.w/6+1,16);
        });
        ctx.restore();
      }
      ctx.strokeStyle='#ffffff88';
      ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.moveTo(x+8,y+3);
      ctx.lineTo(x+p.w-8,y+3);
      ctx.stroke();
      if(p.type==='sand') {
        ctx.fillStyle='#cd9c92';
        for(let i=10;
        i<p.w;
        i+=14)ellipse(x+i,y+8,1,1,'#d3a496');
        if(p.sink>4) {
          ctx.globalAlpha=.5;
          ellipse(x+4,y+20+Math.sin(t*7)*6,2,3,'#FFD3B6');
          ellipse(x+p.w-4,y+28+Math.sin(t*6)*8,2,3,'#FFD3B6');
          ctx.globalAlpha=1;
        }
      }
    }
  }
  function drawBlock(b,t) {
    if(b.dead)return;
    const offset=-Math.sin(clamp(b.bump/.23,0,1)*Math.PI)*10,x=b.x,y=b.y+offset;
    ctx.save();
    ctx.translate(x+22,y+22);
    if(b.type==='prize') {
      rounded(-22,-19,44,44,9,'#bea0b8');
      const grad=ctx.createLinearGradient(-20,-20,20,20);
      grad.addColorStop(0,b.used?'#d5c8d2':'#fff1b6');
      grad.addColorStop(1,b.used?'#c5b6ca':'#f2d8a7');
      rounded(-22,-23,44,44,9,grad);
      rounded(-18,-19,36,36,6,null,b.used?'#e7dce733':'#fff9ddc4');
      if(!b.used) {
        star(0,-1,10,'#ac8d6e',Math.sin(t*2)*.07);
        ellipse(-13,-14,1.5,1.5,'#c3a27c');
        ellipse(13,12,1.5,1.5,'#c3a27c');
        for(let i=0;
        i<3;
        i++) {
          const a=t*.7+i*TAU/3;
          ctx.globalAlpha=.35+.25*Math.sin(t*3+i);
          star(Math.cos(a)*32,Math.sin(a)*28,3,'#fff9dd',a);
        }
      }else ellipse(0,0,3,3,'#aa99b5');
    }else {
      rounded(-22,-20,44,44,6,'#c999ad');
      rounded(-22,-23,44,43,6,'#e4b7c6');
      ctx.strokeStyle='#bb8ba15c';
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(-21,-2);
      ctx.lineTo(21,-2);
      ctx.moveTo(0,-21);
      ctx.lineTo(0,-2);
      ctx.moveTo(-11,0);
      ctx.lineTo(-11,18);
      ctx.moveTo(11,0);
      ctx.lineTo(11,18);
      ctx.stroke();
      ctx.strokeStyle='#fff2e789';
      ctx.beginPath();
      ctx.moveTo(-16,-18);
      ctx.lineTo(16,-18);
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawPickup(c,t) {
    if(c.dead)return;
    if(c.type==='relic'){drawRelic(c,t);return;}
    const y=c.y+Math.sin(t*2.8+c.phase)*4-(c.emerge?Math.sin(c.emerge/.55*Math.PI)*25:0);
    ctx.save();
    ctx.translate(c.x+c.w/2,y+c.h/2);
    if(c.type==='coin') {
      ctx.scale(.78+Math.sin(t*2+c.phase)*.18,1);
      star(1,2,12,'#ddbb72',0,5);
      star(0,0,12,'#fff1b0',0,5);
      star(-1,-1,7,'#ffe5a1',0,5);
      ellipse(-2,-3,1.6,3,'#fffbe3');
    }else if(c.type==='gem') {
      ctx.rotate(Math.sin(t+c.phase)*.15);
      ctx.beginPath();
      ctx.moveTo(0,-15);
      ctx.lineTo(12,-3);
      ctx.lineTo(0,15);
      ctx.lineTo(-12,-3);
      ctx.closePath();
      ctx.fillStyle='#d5b5e1';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0,-15);
      ctx.lineTo(0,15);
      ctx.lineTo(-12,-3);
      ctx.closePath();
      ctx.fillStyle='#f4d8f0';
      ctx.fill();
      star(12,-13,3,'#fff9f5',t);
    }else {
      const glow=ctx.createRadialGradient(0,0,2,0,0,32);
      glow.addColorStop(0,c.type==='lotus'?'#ffb7d569':'#d4bbff85');
      glow.addColorStop(1,'#fff1ff00');
      ellipse(0,0,32,32,glow);
      if(c.type==='lotus') {
        ellipse(0,10,15,4,'#a8d8ba');
        for(let i=-2;
        i<=2;
        i++) {
          ctx.save();
          ctx.rotate(i*.35);
          ellipse(i*3,-3,5,11,i%2?'#f8c6d4':'#f4a9c2');
          ctx.restore();
        }
        ellipse(0,-5,4,8,'#fff1cb');
      }else {
        star(0,0,17,'#bda4da',t*.8,5);
        star(0,-1,13,'#eee1ff',t*.8,5);
        ellipse(-3,-1,1.5,2,'#8972a5');
        ellipse(3,-1,1.5,2,'#8972a5');
      }
      star(22,-14,3,'#fff7dc',t);
    }
    ctx.restore();
  }
  function drawEnemy(e,t) {
    if(art.enemy(e,t))return;
    if(e.dead&&e.squish<=0)return;
    ctx.save();
    ctx.translate(e.x+e.w/2,e.y+e.h);
    if(e.dead)ctx.scale(1.25,Math.max(.08,e.squish/.35)*.32);
    else ctx.scale(1+Math.sin(e.t*5)*.035,1-Math.sin(e.t*5)*.035);
    ellipse(0,2,18,4,'#70627918');
    if(e.type==='flutter') {
      ctx.save();
      ctx.rotate(Math.sin(e.t*15)*.35);
      ellipse(-22,-20,14,7,'#faf1ff');
      ellipse(22,-20,14,7,'#faf1ff');
      ctx.restore();
      ellipse(0,-15,17,17,'#c4a4db');
      ellipse(-3,-19,12,11,'#ddc4eb');
      star(0,-30,5,'#fff1b7',t);
    }else if(e.type==='spike') {
      for(let i=0;
      i<5;
      i++) {
        const a=Math.PI+i*Math.PI/4;
        ctx.beginPath();
        const xx=Math.cos(a)*17,yy=-12+Math.sin(a)*17;
        ctx.moveTo(xx-5,yy+5);
        ctx.lineTo(xx,yy-7);
        ctx.lineTo(xx+5,yy+5);
        ctx.fillStyle='#aa96b7';
        ctx.fill();
      }
      ellipse(0,-12,17,15,'#cab4cd');
      ellipse(-3,-15,12,10,'#e1cada');
    }else {
      ellipse(-9,0,7,3,'#b4a4bd');
      ellipse(9,0,7,3,'#b4a4bd');
      ctx.beginPath();
      ctx.moveTo(-18,-3);
      ctx.bezierCurveTo(-18,-35,18,-35,18,-3);
      ctx.quadraticCurveTo(0,3,-18,-3);
      ctx.fillStyle='#e5b4c1';
      ctx.fill();
      ellipse(-6,-21,8,4,'#f6ccd3');
    }
    if(!e.dead) {
      ellipse(-5,-13,1.6,2.5,'#77617d');
      ellipse(5,-13,1.6,2.5,'#77617d');
      ellipse(-10,-8,3,1.8,'#f1a6b5');
      ellipse(10,-8,3,1.8,'#f1a6b5');
    }
    ctx.restore();
  }
  function drawPlayer(p,t,hero=false) {
    if(art.hero(p,t,hero))return;
    ctx.save();
    const cx=p.x+p.w/2,cy=p.y+p.h;
    ctx.translate(cx,cy);
    const unit=p.w/26,run=p.grounded?Math.sin(p.walk):0,squash=p.squash+(p.grounded?Math.sin(t*2.7)*.018:0);
    let sx=1+squash,sy=1-squash;
    if(!p.grounded&&!hero) {
      sx*=p.vy<0?1.03:.9;
      sy*=p.vy<0?.94:1.1;
    }
    ctx.scale(unit*sx,unit*sy);
    if(p.invincible>0&&!hero&&Math.sin(t*28)>0)ctx.globalAlpha=.55;
    const glow=ctx.createRadialGradient(0,-18,0,0,-18,46);
    glow.addColorStop(0,p.flight>0?'#e3cfff66':'#fff7d52e');
    glow.addColorStop(1,'#fff1ff00');
    ellipse(0,-18,46,46,glow);
    // Petal cape, leaf arms, marshmallow body, and flower crown.
    ctx.save();
    ctx.rotate(-p.facing*.13+run*.06);
    ctx.beginPath();
    ctx.moveTo(-p.facing*4,-25);
    ctx.bezierCurveTo(-p.facing*24,-23,-p.facing*29,-11+Math.sin(t*8)*3,-p.facing*13,-9);
    ctx.lineTo(0,-9);
    ctx.fillStyle=p.flight>0?'#c6b3e7':'#eaa5b6';
    ctx.fill();
    ctx.restore();
    ellipse(-8,-2-run*2,7,4,'#c5a9bd');
    ellipse(8,-2+run*2,7,4,'#c5a9bd');
    ctx.save();
    ctx.rotate(-.4+run*.25);
    ellipse(-14,-14,4,7,'#b2d8c4');
    ctx.restore();
    ctx.save();
    ctx.rotate(.4-run*.25);
    ellipse(14,-14,4,7,'#b2d8c4');
    ctx.restore();
    const body=ctx.createLinearGradient(0,-33,0,0);
    body.addColorStop(0,'#fff9e9');
    body.addColorStop(1,p.flight>0?'#e8dbf7':'#f6dccd');
    ctx.beginPath();
    ctx.moveTo(-13,-7);
    ctx.bezierCurveTo(-17,-36,15,-40,14,-7);
    ctx.quadraticCurveTo(13,2,0,1);
    ctx.quadraticCurveTo(-12,2,-13,-7);
    ctx.fillStyle=body;
    ctx.fill();
    const face=p.facing*2,blink=mod(t,4.2)>4.02;
    ellipse(face-4,-18,1.5,blink?.4:2.2,'#74617d');
    ellipse(face+5,-18,1.5,blink?.4:2.2,'#74617d');
    ellipse(face-8,-13,3,1.8,'#f3b2ba');
    ellipse(face+9,-13,3,1.8,'#f3b2ba');
    ctx.strokeStyle='#a27f90';
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.arc(face+1,-14,2.3,.1,Math.PI-.1);
    ctx.stroke();
    ctx.save();
    ctx.translate(0,-33);
    ctx.rotate(Math.sin(t*3)*.06+run*.035);
    for(let i=0;
    i<5;
    i++) {
      const a=i*TAU/5-Math.PI/2;
      ctx.save();
      ctx.translate(Math.cos(a)*6,Math.sin(a)*5);
      ctx.rotate(a);
      ellipse(0,0,7,4.5,p.flight>0?'#d5b9ed':'#f6b5c4');
      ctx.restore();
    }
    ellipse(0,0,4.2,4.2,'#fff0a6');
    ellipse(-1,-1,1.6,1.6,'#fff9dc');
    ctx.restore();
    if(p.flight>0) {
      ctx.globalAlpha=.8;
      for(let i=0;
      i<3;
      i++)star(Math.cos(t*2+i*2)*25,-18+Math.sin(t*2+i*2)*20,2.8,'#fff6d9',t);
    }
    ctx.restore();
  }
  function drawShrine(c,t) {
    const x=c.shrine.x,y=c.shrine.y,active=game.checkpoint>=c.x;
    ctx.save();
    ctx.translate(x,y);
    ellipse(0,2,45,8,'#8d799719');
    ctx.strokeStyle=active?'#bba8cc':'#c7b8c6';
    ctx.lineWidth=7;
    ctx.beginPath();
    ctx.moveTo(-28,0);
    ctx.lineTo(-28,-58);
    ctx.bezierCurveTo(-28,-104,28,-104,28,-58);
    ctx.lineTo(28,0);
    ctx.stroke();
    for(let i=0;
    i<5;
    i++) {
      const a=Math.PI+i*Math.PI/4;
      flower(Math.cos(a)*28,-58+Math.sin(a)*33,.55,t,i%2?'#FFD3B6':'#fff7d3');
    }
    ctx.globalAlpha=.5+Math.sin(t*2)*.15;
    star(0,-49,18,active?'#fff1a8':'#e7c9e1',t*.2,5);
    ctx.globalAlpha=1;
    ctx.font='9px "Trebuchet MS", sans-serif';
    ctx.textAlign='center';
    ctx.fillStyle='#8d739e';
    ctx.fillText(active?'GARDEN SAVED':'CHECKPOINT',0,-112);
    ctx.restore();
  }
  function drawDecor(d,t) {
    if(d.x<game.camera-80||d.x>game.camera+viewW+80)return;
    const {
      x,y,size:s,kind:k,biome:b
    }
    =d;
    if(b===0) {
      if(k<.48)flower(x,y,s,t,k<.2?'#fff6d7':'#f4bfd0');
      else if(k<.73)mushroom(x,y,s,t);
      else {
        ctx.strokeStyle='#98c6aa';
        ctx.lineWidth=2;
        for(let i=-1;
        i<2;
        i++) {
          ctx.beginPath();
          ctx.moveTo(x,y);
          ctx.quadraticCurveTo(x+i*8,y-15,x+i*9+Math.sin(t*1.3+x)*3,y-21-i*4);
          ctx.stroke();
        }
      }
    }else if(b===1) {
      if(k<.4)mushroom(x,y,s*.8,t,'#c8ace0');
      else {
        ctx.globalAlpha=.75;
        star(x,y-15-Math.sin(t+x)*5,5*s,k<.7?'#fff4bb':'#e3c2ed',t*.1);
        ctx.globalAlpha=1;
      }
    }else if(b===2) {
      if(k<.4) {
        rounded(x-6*s,y-34*s,12*s,35*s,6,'#aacdbd');
        rounded(x-17*s,y-24*s,11*s,7*s,4,'#aacdbd');
        rounded(x-18*s,y-33*s,5*s,16*s,3,'#aacdbd');
        rounded(x+4*s,y-19*s,12*s,6*s,4,'#aacdbd');
        rounded(x+12*s,y-28*s,5*s,13*s,3,'#aacdbd');
        flower(x,y-31*s,s*.4,t,'#f3b1bd');
      }else if(k<.66)ellipse(x,y-3,12*s,6*s,'#d6aca5');
      else flower(x,y,s*.65,t,'#fff1c1');
    }else {
      if(k<.5) {
        const glow=ctx.createRadialGradient(x,y-25,1,x,y-25,40);
        glow.addColorStop(0,'#c5f4e82e');
        glow.addColorStop(1,'#c5f4e800');
        ellipse(x,y-25,40,40,glow);
        mushroom(x,y,s,t,k<.2?'#b6dbd8':'#d8bade');
      }else if(k<.7)lantern(x,y-25,s*.8,t);
      else flower(x,y,s,t,'#c9f0db');
    }
  }
  function render() {
    game.renderCount++;
    ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);
    const menu=game.state==='MENU',theme=themeAt(menu?1600:visualX()),t=game.time,cam=menu?game.time*9:game.camera;
    drawBackground(cam,theme,t);
    if(menu) {
      drawTitleScene(t);
    }else {
      ctx.save();
      const shake=reduced?0:game.shake*8;
      ctx.translate(-cam+(Math.random()-.5)*shake,-game.camY+(Math.random()-.5)*shake);
      for(const c of game.world.chunks.values()) {
        if(c.x>cam+viewW+150||c.x+CHUNK<cam-150)continue;
        for(const g of c.ground)drawGround(g,theme,t);
        for(const d of c.decor)drawDecor(d,t);
        if(c.shrine)drawShrine(c,t);
      }
      for(const p of game.world.platforms)if(p.x>cam-250&&p.x<cam+viewW+100)drawPlatform(p,theme,t);
      for(const b of game.world.blocks)if(b.x>cam-100&&b.x<cam+viewW+100)drawBlock(b,t);
      for(const c of game.world.pickups)if(c.x>cam-100&&c.x<cam+viewW+100)drawPickup(c,t);
      for(const e of game.world.enemies)if(e.x>cam-100&&e.x<cam+viewW+100)drawEnemy(e,t);
      for(const ghost of game.ghosts)art.hero(ghost,t,false,ghost.life/.22*.23);
      art.keeper(game.boss,t);
      if(game.mode==='story')art.gate(BIOME*4+1510,t,game.boss?.defeated);
      if(game.deathTimer<=0)drawPlayer(game.player,t);
      drawCompanion(t);
      for(const pulse of game.pulses){ctx.save();ctx.globalAlpha=pulse.life*.7;ctx.strokeStyle='#fff4c6';ctx.lineWidth=2;ctx.beginPath();ctx.arc(pulse.x,pulse.y,pulse.r,0,TAU);ctx.stroke();ctx.restore();}

      for(const p of game.particles) {
        ctx.globalAlpha=clamp(p.life/.35,0,1);
        if(p.star)star(p.x,p.y,p.size,p.color,p.rotation);
        else {
          ctx.save();
          ctx.translate(p.x,p.y);
          ctx.rotate(p.rotation);
          rounded(-p.size/2,-p.size/2,p.size,p.size,1,p.color);
          ctx.restore();
        }
      }
      ctx.globalAlpha=1;
      ctx.textAlign='center';
      ctx.font='bold 16px "Trebuchet MS",sans-serif';
      for(const p of game.popups) {
        ctx.globalAlpha=clamp(p.life/.5,0,1);
        ctx.fillStyle=p.color;
        ctx.fillText(p.text,p.x,p.y);
      }
      ctx.globalAlpha=1;
      ctx.restore();
      if(game.deathTimer>0) {
        ctx.fillStyle=`rgba(255,247,239,${Math.sin(game.deathTimer/1.25*Math.PI)*.5})`;
        ctx.fillRect(0,0,viewW,H);
      }
    }
    if(!menu)art.foreground(cam,t,viewW);
    // Paper-grain dots are deterministic, inexpensive, and asset-free.
    ctx.globalAlpha=.028;
    ctx.fillStyle='#6c567f';
    for(let i=0;
    i<190;
    i++) {
      const n=hash(i*7919);
      ctx.fillRect(n%Math.ceil(viewW),(n>>>12)%H,1,1);
    }
    ctx.globalAlpha=1;
    if(game.renderCount%6===0)updateHUD();
  }
  function updateHUD() {
    const p=game.player;
    $('score').textContent=Math.floor(game.score).toString().padStart(5,'0');
    $('distance').textContent=Math.floor(Math.max(0,game.maxX-110)/METRE).toLocaleString()+' m';
    $('coins').textContent=game.coins;
    $('lives').textContent='♡ '.repeat(Math.max(0,game.lives)).trim();
    const n=Math.floor(visualX()/BIOME);
    $('biomeName').textContent=THEMES[n%4].name;
    $('biomeProgress').style.width=(clamp((game.maxX-n*BIOME)/BIOME,0,1)*100)+'%';
    $('objective').textContent=game.mode==='story'?(game.boss?.defeated?'The gate is open · step into the light →':game.boss?.active?'Awaken the Moonkeeper':game.relics.size+' / 12 memory petals · Chapter '+(n+1)+' / 4'):'Endless wandering · Season '+(Math.floor(game.maxX/(BIOME*4))+1);
    $('ability').textContent=p.flight>0?'✧ Starfall · '+Math.ceil(p.flight)+'s · hold jump to float':p.big?'✿ Blossom form · Shift to dash':game.maxX>=BIOME*2?'✧ Dash · double jump · glide':game.maxX>=BIOME?'✧ Dash · double jump':game.maxX>=CHECKPOINT?'✧ Petal dash awakened':'Little blossom';
  }
  function updateSound() {
    $('soundButton').setAttribute('aria-label',audio.muted?'Unmute audio':'Mute audio');
    $('soundIcon').innerHTML='<path d="M11 5 6 9H3v6h3l5 4Z"/>'+(audio.muted?'<path d="m16 9 6 6m0-6-6 6"/>':'<path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/>');
  }
  let helpPrevious='MENU';
  function openHelp() {
    if(!$('settings').hidden)closeSettings();
    helpPrevious=game.state;
    if(game.state==='PLAYING')setState('PAUSED');
    $('help').hidden=false;
    clearInput();
    $('closeHelp').focus();
  }
  function closeHelp() {
    $('help').hidden=true;
    if(helpPrevious==='PLAYING')setState('PLAYING');
  }
  async function fullscreen() {
    try {
      if(document.fullscreenElement)await document.exitFullscreen();
      else if($('frame').requestFullscreen)await $('frame').requestFullscreen();
      else toast('Your browser is already your window.','Rotate your phone for the widest view.',3);
    }catch {
      toast('Fullscreen unavailable','You can keep playing in this window.',3);
    }
  }
  $('startButton').onclick=()=>start('story');
  $('restartButton').onclick=start;
  $('pauseRestart').onclick=start;
  $('resumeButton').onclick=togglePause;
  $('pauseButton').onclick=togglePause;
  $('homeButton').onclick=()=> {
    saveBest();
    setState('MENU');
  };
  $('helpButton').onclick=openHelp;
  $('closeHelp').onclick=closeHelp;
  $('soundButton').onclick=()=> {
    audio.unlock();
    audio.toggle();
  };
  $('fullscreenButton').onclick=fullscreen;
  window.addEventListener('blur',()=> {
    clearInput();
    if(game.state==='PLAYING'&&game.deathTimer<=0) {
      setState('PAUSED');
      saveBest();
    }
  });
  document.addEventListener('visibilitychange',()=> {
    if(document.hidden) {
      clearInput();
      if(game.state==='PLAYING'&&game.deathTimer<=0) {
        setState('PAUSED');
        saveBest();
      }
    }else {
      lastTime=performance.now();
      accumulator=0;
    }
  });
  window.addEventListener('pagehide',saveBest);
  let lastTime=performance.now(),accumulator=0;
  function frame(now) {
    pollGamepad();
    const elapsed=Math.min(.1,(now-lastTime)/1000);
    lastTime=now;
    accumulator+=elapsed;
    while(accumulator>=STEP) {
      update(STEP);
      accumulator-=STEP;
    }
    render();
    requestAnimationFrame(frame);
  }
  // Campaign state is deliberately local. No account, server or telemetry.
  function readPreferences(){
    const defaults={music:.45,sfx:.65,quality:'high',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
    try{
      const p=JSON.parse(localStorage.getItem('petalbound-deluxe-preferences')||'null');
      if(p){defaults.music=clamp(Number(p.music)||0,0,1);defaults.sfx=clamp(Number(p.sfx)||0,0,1);defaults.quality=p.quality==='low'?'low':'high';defaults.reducedMotion=Boolean(p.reducedMotion);}
    }catch{}
    return defaults;
  }
  function readSavedStory(){
    try{
      const s=JSON.parse(localStorage.getItem('petalbound-deluxe-story')||'null');
      if(s&&s.version===2&&Number.isInteger(s.seed)&&Number.isFinite(s.checkpoint)&&s.checkpoint>=CHECKPOINT&&s.checkpoint<=BIOME*4&&s.checkpoint%CHECKPOINT===0&&Array.isArray(s.relics)&&s.relics.every(n=>Number.isInteger(n)&&n>=0&&n<12)&&['maxX','score','coins','lives','playtime'].every(k=>Number.isFinite(s[k])&&s[k]>=0))return s;
    }catch{}
    return null;
  }
  function refreshContinue(){
    $('continueStory').hidden=!savedStory;
    if(savedStory)$('continueStory').textContent='Continue · Chapter '+Math.min(4,Math.floor(savedStory.checkpoint/BIOME)+1)+' ↗';
  }
  function saveStory(){
    if(game.mode!=='story'||game.checkpoint<=0||game.state==='MENU'||game.state==='VICTORY')return;
    savedStory={version:2,seed:game.seed,checkpoint:game.checkpoint,maxX:game.maxX,score:game.score,coins:game.coins,lives:Math.max(3,game.lives),playtime:game.playtime,relics:[...game.relics]};
    try{localStorage.setItem('petalbound-deluxe-story',JSON.stringify(savedStory));}catch{}
  }
  function resumeStory(){
    if(!savedStory){start('story');return;}
    audio.unlock();const s={...savedStory,relics:[...savedStory.relics]};
    game.mode='story';game.seed=s.seed;game.relics=new Set(s.relics);
    game.world=new World(s.seed);game.player=new Player(s.checkpoint+115);
    Object.assign(game,{checkpoint:s.checkpoint,nextCheckpoint:s.checkpoint+CHECKPOINT,maxX:Math.max(s.checkpoint+115,s.maxX||0),score:Math.max(0,s.score||0),coins:Math.max(0,s.coins||0),lives:clamp(s.lives||3,3,5),playtime:Math.max(0,s.playtime||0),camera:Math.max(0,s.checkpoint+115-viewW*.32),camY:0,deathTimer:0,particles:[],popups:[],ghosts:[],pulses:[],hitstop:0,shake:0,runStartBest:game.best,boss:makeKeeper(),companion:{x:s.checkpoint+70,y:470},lastBiome:Math.floor(s.checkpoint/BIOME)});
    game.world.stream(game.player.x,game.checkpoint);$('help').hidden=true;$('settings').hidden=true;
    setState('PLAYING');toast('Welcome back, little light.','Your checkpoint garden remembers.',4);canvas.focus({preventScroll:true});
  }
  function visualX(){return game.mode==='story'?Math.min(game.maxX,BIOME*3+BIOME*.82):game.maxX;}
  function makeKeeper(){return{active:false,defeated:false,x:BIOME*4+690,y:350,hp:5,t:0,weak:false,flash:0,shootClock:1.5,shots:[]};}
  function updateDrifters(dt){
    const p=game.player;
    for(const leaf of game.world.platforms){
      if(leaf.type!=='drift')continue;
      const old=leaf.x;leaf.x=leaf.baseX+Math.sin(game.playtime*.9+leaf.baseX)*44;
      if(p.grounded&&Math.abs(p.y+p.h-leaf.y)<3&&p.x+p.w>old&&p.x<old+leaf.w)p.x+=leaf.x-old;
    }
  }
  function updateDeluxe(dt,previousBottom){
    const p=game.player,companion=game.companion;
    const f=1-Math.exp(-dt*4);
    companion.x=lerp(companion.x,p.x-p.facing*32,f);
    companion.y=lerp(companion.y,p.y-25+Math.sin(game.playtime*3)*9,f);
    if(p.dash>0&&game.renderCount%2===0){
      const last=game.ghosts[game.ghosts.length-1];
      if(!last||Math.abs(last.x-p.x)>14)game.ghosts.push({...p,life:.22,invincible:0});
    }
    if(game.ghosts.length>9)game.ghosts.shift();
    if(game.mode!=='story')return;
    const arena=BIOME*4,b=game.boss;
    if(!b)return;
    if(p.x>arena+140&&!b.active&&!b.defeated){
      b.active=true;b.t=0;b.shootClock=1.7;game.checkpoint=arena;game.nextCheckpoint=arena+CHECKPOINT;
      saveStory();toast('The Moonkeeper','Dodge the dream wisps. Stomp or dash when its wings settle.',6);
    }
    if(b.active){
      b.t+=dt;b.flash=Math.max(0,b.flash-dt);b.weak=b.t%6>3;
      b.x=arena+720+Math.sin(b.t*.7)*210;
      const target=b.weak?506:352;
      b.y=lerp(b.y,target,1-Math.exp(-dt*3.2));
      b.shootClock-=dt;
      if(!b.weak&&b.shootClock<=0){
        b.shootClock=b.hp<=2?.8:1.2;
        const angle=Math.atan2(p.y+p.h*.5-b.y,p.x+p.w*.5-b.x);
        for(const spread of b.hp<=2?[-.13,.13]:[0]){
          const a=angle+spread;b.shots.push({x:b.x,y:b.y+12,vx:Math.cos(a)*175,vy:Math.sin(a)*175,life:6});
        }
        audio.fx('bump');
      }
      for(const shot of b.shots){
        shot.life-=dt;shot.x+=shot.vx*dt;shot.y+=shot.vy*dt;
        if(shot.y>GROUND-10){shot.y=GROUND-10;shot.vy=-Math.abs(shot.vy)*.5-45;}
        if(overlap(p,{x:shot.x-6,y:shot.y-6,w:12,h:12})){
          shot.life=0;
          if(p.dash>0){burst(shot.x,shot.y,'#f0dcff',7,90);game.score+=25;}else hurt();
        }
      }
      b.shots=b.shots.filter(s=>s.life>0);
      const core={x:b.x-47,y:b.y-36,w:94,h:73};
      if(overlap(p,core)&&b.flash<=0&&game.deathTimer<=0){
        const stomp=p.vy>0&&previousBottom<=core.y+22;
        if(b.weak&&(stomp||p.dash>0)){
          b.hp--;b.flash=1.1;p.vy=-535;p.airJump=true;p.invincible=Math.max(p.invincible,.8);
          game.score+=800;game.shake=.2;game.hitstop=.075;
          game.pulses.push({x:b.x,y:b.y,r:8,life:.8});burst(b.x,b.y,'#fff0c3',36,210);audio.fx('power');
          if(b.hp<=0){
            b.active=false;b.defeated=true;b.shots=[];game.score+=5000;
            toast('The Moonkeeper remembers.','The gate is open. Step into the light →',7);
            burst(b.x,b.y,'#f7c6dc',60,250);audio.fx('checkpoint');saveBest();
          }
        }else if(p.dash>0){p.vx=-p.facing*200;p.dash=0;p.invincible=Math.max(p.invincible,.3);}else hurt();
      }
      p.x=clamp(p.x,arena+35,arena+1475);
      $('bossHud').hidden=game.state!=='PLAYING';
      $('bossHealth').textContent='✧ '.repeat(Math.max(0,b.hp)).trim();
      $('bossHint').textContent=b.weak?'Wings settled · stomp or dash!':'Dodge the dream wisps';
    }else $('bossHud').hidden=true;
    if(b.defeated&&p.x>arena+1460&&game.deathTimer<=0)finishStory();
  }
  function finishStory(){
    game.score+=game.relics.size*250;saveBest();
    $('victoryScore').textContent=game.score.toLocaleString();$('victoryRelics').textContent=game.relics.size+' / 12';
    const secs=Math.floor(game.playtime);$('victoryTime').textContent=Math.floor(secs/60)+':'+String(secs%60).padStart(2,'0');
    setState('VICTORY');savedStory=null;try{localStorage.removeItem('petalbound-deluxe-story');localStorage.setItem('petalbound-deluxe-complete','true');}catch{}
    refreshContinue();audio.fx('checkpoint');
  }
  function drawLeafPlatform(p,t){
    const c=ctx,x=p.x,y=p.y,night=Math.floor(visualX()/BIOME)%4===3,sand=p.type==='sand';
    c.save();
    const rock=c.createLinearGradient(0,y,0,y+48);rock.addColorStop(0,sand?'#d49c89':night?'#6d83a4':'#73977f');rock.addColorStop(1,sand?'#ae796d':night?'#485976':'#4b7066');
    c.beginPath();c.moveTo(x+3,y+9);c.bezierCurveTo(x+13,y+40,x+p.w*.35,y+26,x+p.w*.52,y+43);c.bezierCurveTo(x+p.w*.7,y+25,x+p.w-12,y+33,x+p.w-2,y+10);c.closePath();c.fillStyle=rock;c.fill();
    const grass=c.createLinearGradient(0,y,0,y+16);grass.addColorStop(0,sand?'#ffe0b0':night?'#b4e5d9':'#b4d9ac');grass.addColorStop(1,sand?'#e7ae8b':night?'#81b8b1':'#86b48c');
    rounded(x,y,p.w,16,8,grass);c.strokeStyle='#fff8df99';c.lineWidth=1.3;c.beginPath();c.moveTo(x+7,y+2);c.lineTo(x+p.w-7,y+2);c.stroke();
    if(p.type==='rainbow'){
      const colors=['#f1afc4','#f8cfb4','#f8e6aa','#a5d5be','#a8cce4','#c5b0df'];
      for(let i=0;i<6;i++){c.strokeStyle=colors[i];c.globalAlpha=.7;c.lineWidth=2;c.beginPath();c.moveTo(x+8,y+18+i*2);c.quadraticCurveTo(x+p.w/2,y+27+i*2,x+p.w-8,y+18+i*2);c.stroke();}c.globalAlpha=1;
    }
    for(let i=18;i<p.w-10;i+=32){const n=hash(i+Math.floor(x));c.strokeStyle=sand?'#d6a38a':'#81a98a';c.lineWidth=1.5;c.beginPath();c.moveTo(x+i,y+14);c.quadraticCurveTo(x+i-6,y+30,x+i+Math.sin(t+i)*3,y+30+n%18);c.stroke();if(!sand)ellipse(x+i-3,y+26,4,2,night?'#b2d6cc':'#a5c49b');}
    if(sand&&p.sink>4){for(let i=0;i<4;i++)ellipse(x+6+i*(p.w-12)/3,y+19+mod(t*30+i*9,30),1.3,2,'#efd0a4');}
    c.restore();
  }
  function drawRelic(relic,t){
    const x=relic.x+12,y=relic.y+12+Math.sin(t*2+relic.phase)*5;
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t)*.1);
    const glow=ctx.createRadialGradient(0,0,1,0,0,38);glow.addColorStop(0,'#fff2bc70');glow.addColorStop(1,'#fff2bc00');
    ellipse(0,0,38,38,glow);ctx.strokeStyle='#fff0c8b8';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,20,0,TAU);ctx.stroke();
    for(let i=0;i<6;i++){ctx.save();ctx.rotate(i*TAU/6+t*.15);ellipse(0,-8,5,10,i%2?'#f6c2dc':'#ffe5c8');ctx.restore();}
    ellipse(0,0,5,5,'#fff0a6');star(22,-13,3,'#fff6e4',t);ctx.restore();
  }
  function drawCompanion(t){
    if(game.deathTimer>0)return;
    const {x,y}=game.companion;
    ctx.save();ctx.globalAlpha=.9;
    const halo=ctx.createRadialGradient(x,y,1,x,y,22);halo.addColorStop(0,'#fff1b86e');halo.addColorStop(1,'#fff1b800');
    ellipse(x,y,22,22,halo);ellipse(x-4,y-1,5,2+Math.sin(t*17),'#eff6f3ac');ellipse(x+4,y-1,5,2+Math.sin(t*17),'#eff6f3ac');ellipse(x,y,3,4,'#fff1b8');ctx.restore();
  }
  function drawTitleScene(t){
    const x=viewW*.77,y=viewW<500?708:620;
    if(viewW<500){
      const p=new Player(x-20,y-44);p.w=43;p.h=44;p.grounded=true;p.invincible=0;p.squash=Math.sin(t*2)*.015;
      drawPlayer(p,t,true);return;
    }
    ctx.save();ctx.beginPath();ctx.moveTo(x-185,y);ctx.bezierCurveTo(x-160,y+96,x+115,y+122,x+175,y);ctx.closePath();ctx.clip();
    art.terrain({x:x-185,y,w:360},0,t);ctx.restore();
    ctx.save();ctx.translate(x,y);ellipse(0,-2,182,12,'#91bca0');
    for(let i=0;i<10;i++)flower(-160+i*32,-4,.5+hash(i)%5/10,t,i%2?'#ffddc1':'#f0bed5');
    mushroom(-125,-3,1.5,t,'#d0a0ba');mushroom(132,-3,1,t,'#d0a0ba');ctx.restore();
    const p=new Player(x-25,y-54);p.w=62;p.h=54;p.grounded=true;p.invincible=0;p.squash=Math.sin(t*2.1)*.015;drawPlayer(p,t,true);
    for(let i=0;i<7;i++)star(x-150+i*49,y-150-Math.sin(t+i)*15,3+i%3,'#fff0c1',t*.2);
  }
  let settingsPrevious='MENU';
  function openSettings(){
    if(!$('help').hidden)closeHelp();settingsPrevious=game.state;
    if(game.state==='PLAYING')setState('PAUSED');
    $('musicVolume').value=Math.round(game.settings.music*100);$('sfxVolume').value=Math.round(game.settings.sfx*100);
    $('quality').value=game.settings.quality;$('reducedMotion').checked=game.settings.reducedMotion;
    $('settings').hidden=false;clearInput();$('closeSettings').focus();
  }
  function closeSettings(){
    $('settings').hidden=true;
    if(settingsPrevious==='PLAYING'){audio.unlock();setState('PLAYING');}
  }
  function savePreferences(){
    game.settings.music=Number($('musicVolume').value)/100;game.settings.sfx=Number($('sfxVolume').value)/100;
    game.settings.quality=$('quality').value;game.settings.reducedMotion=$('reducedMotion').checked;
    reduced=game.settings.reducedMotion;soundtrack.volume=game.settings.music;
    if(audio.master)audio.master.gain.setTargetAtTime(audio.muted?0:game.settings.sfx,audio.ctx.currentTime,.05);
    try{localStorage.setItem('petalbound-deluxe-preferences',JSON.stringify(game.settings));}catch{}
    resize();
  }
  let padMenuDown=false;
  function pollGamepad(){
    if(!navigator.getGamepads)return;
    let controller;try{controller=[...navigator.getGamepads()].find(Boolean);}catch{return;}
    if(!controller){if(Object.values(pad).some(Boolean)){for(const k in pad)pad[k]=false;syncInput();}return;}
    const axes=controller.axes,buttons=controller.buttons;
    pad.left=axes[0]<-.25||Boolean(buttons[14]?.pressed);pad.right=axes[0]>.25||Boolean(buttons[15]?.pressed);
    pad.jump=Boolean(buttons[0]?.pressed);pad.dash=Boolean(buttons[2]?.pressed||buttons[5]?.pressed);
    const menu=Boolean(buttons[9]?.pressed);
    if(menu&&!padMenuDown){if(game.state==='MENU')start('story');else if(game.state==='GAMEOVER')start();else togglePause();}
    padMenuDown=menu;syncInput();
  }
  $('continueStory').onclick=resumeStory;$('endlessStart').onclick=()=>start('endless');
  $('victoryEndless').onclick=()=>start('endless');$('victoryHome').onclick=()=>setState('MENU');
  $('settingsButton').onclick=openSettings;$('closeSettings').onclick=closeSettings;
  for(const id of ['musicVolume','sfxVolume','quality','reducedMotion'])$(id).addEventListener('input',savePreferences);
  refreshContinue();

  updateSound();
  $('menuBest').textContent=game.best.toLocaleString()+' m';
  $('menuBestScore').textContent=game.bestScore.toLocaleString();
  window.PetalAssets.ready.then(()=>{$('loading').remove();if(window.PetalAssets.failures.length)toast('A few painted pages could not open.','Make sure the full assets folder stays beside index.html.',7);});
  requestAnimationFrame(frame);
})();
