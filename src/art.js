/* Painted assets with independently moving atmosphere, lighting and foreground.
   No image is fetched from a CDN; atlas rectangles refer to bundled originals. */
window.PetalArt = class PetalArt {
  constructor(ctx, assets, helpers) {
    this.ctx = ctx;
    this.assets = assets;
    Object.assign(this, helpers);
    this.names = ['meadow', 'clouds', 'desert', 'twilight'];
    this.terrainColors = [
      ['#98cfa5','#6f9c7a','#55756d','#314c52'],
      ['#f4d9ee','#b59bc9','#8e789f','#57496b'],
      ['#f7c896','#d39278','#ae756b','#714e62'],
      ['#b3d9cd','#6cafa8','#536b86','#323d65']
    ];
  }
  background(cam, t, x, width, theme, menu) {
    const c = this.ctx, H = 720;
    const biome = menu ? Math.floor(t / 24) % 4 : Math.floor(Math.max(0, x) / 9600) % 4;
    const blend = menu ? this.smooth(this.clamp((t % 24 - 20) / 4, 0, 1)) : this.smooth(this.clamp((x % 9600 / 9600 - .83) / .17, 0, 1));
    const sky = c.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,theme.top); sky.addColorStop(1,theme.bottom);
    c.fillStyle = sky; c.fillRect(0,0,width,H);
    for (const [index, alpha] of [[biome,1-blend],[(biome+1)%4,blend]]) {
      if (alpha < .001) continue;
      const image = this.assets.images[this.names[index]];
      if (!image) continue;
      c.save(); c.globalAlpha = alpha;
      const ih = H + 26, iw = ih * image.width / image.height;
      const offset = menu ? Math.sin(t * .025) * 60 : cam * .13;
      const start = Math.floor(offset / iw);
      for (let i = start; i < Math.ceil((offset + width)/iw) + 1; i++) {
        const xx = i * iw - offset;
        c.save(); c.translate(xx, -13 + Math.sin(t*.1)*3);
        if (((i%2)+2)%2) { c.translate(iw,0); c.scale(-1,1); }
        c.drawImage(image,0,0,iw,ih); c.restore();
      }
      c.restore();
    }
    // A distinct veil of near clouds moves faster than the painted distance.
    c.save();
    const mist = c.createLinearGradient(0,385,0,660);
    mist.addColorStop(0,'#eaf6ff00');
    mist.addColorStop(.6,biome===3?'#bec7ef12':'#fff7e91b');
    mist.addColorStop(1,biome===3?'#8092cd00':'#fff7e900');
    c.fillStyle = mist; c.fillRect(0,385,width,275);
    c.globalAlpha=.12;
    for(let i=-1;i<Math.ceil(width/520)+2;i++) {
      const xx=i*520-this.mod(cam*.28,520)+Math.sin(t*.1+i)*35;
      this.cloud(xx,477+Math.sin(i*2)*42,2.2,.15);
    }
    c.restore();
    if (!this.game.settings.reducedMotion && this.game.settings.quality !== 'low') {
      c.save(); c.globalCompositeOperation='screen';
      const light=c.createLinearGradient(width*.7,0,width*.2,720);
      light.addColorStop(0,biome===3?'#d7d9fa13':'#fff6ca28');
      light.addColorStop(1,'#fff6ca00');
      c.fillStyle=light;
      for(let i=0;i<4;i++) {
        const xx=width*.64+i*80+Math.sin(t*.09+i)*15;
        c.beginPath();c.moveTo(xx,0);c.lineTo(xx+24,0);
        c.lineTo(xx-380,720);c.lineTo(xx-520,720);c.closePath();c.fill();
      }
      c.restore();
    }
    this.atmosphere(cam,t,width,biome,blend);
  }
  atmosphere(cam,t,width,biome,blend) {
    const c=this.ctx, count=this.game.settings.quality==='low'?26:64;
    for(const [kind,alpha] of [[biome,1-blend],[(biome+1)%4,blend]]) {
      if(alpha<.001)continue;
      for(let i=0;i<count;i++) {
        const n=this.hash(i*119+74),near=i%3===0,depth=near?1.08:.42;
        const x=this.mod(n%2400-cam*depth+Math.sin(t*.3+i)*18,width+80)-40;
        const y=this.mod((n>>>10)%760+t*(kind===0?15:kind===2?11:-7),780)-30;
        c.save();c.globalAlpha=alpha*(near?.48:.24)*(kind===3?.6+Math.sin(t*2+i)*.4:1);
        if(kind===0){c.translate(x,y);c.rotate(t*.65+i);this.ellipse(0,0,near?5:2.5,near?2.2:1.2,i%2?'#ffdbc6':'#fff0d8');}
        else if(kind===2)this.ellipse(x,y,near?1.7:.8,near?1.7:.8,'#ffe0b2');
        else { if(kind===3&&near&&this.game.settings.quality==='high'){c.shadowColor='#c0ffe0';c.shadowBlur=8;}this.star(x,y,near?3:1.5,kind===3?'#d0ffe7':'#fff5d8',t*.2); }
        c.restore();
      }
    }
  }
  terrain(g,worldX,t) {
    const c=this.ctx,index=Math.floor(Math.max(0,worldX)/9600)%4;
    const blend=this.smooth(this.clamp((worldX%9600/9600-.83)/.17,0,1));
    const palette=this.terrainColors[index].map((v,i)=>this.mixColor(v,this.terrainColors[(index+1)%4][i],blend));
    const {x,y,w}=g;
    c.save(); c.beginPath();c.roundRect(x,y,w,252,[11,11,0,0]);c.clip();
    const earth=c.createLinearGradient(0,y,0,y+235);
    earth.addColorStop(0,palette[1]);earth.addColorStop(.11,palette[2]);earth.addColorStop(1,palette[3]);
    c.fillStyle=earth;c.fillRect(x,y,w,255);
    // Stratified rock facets and roots give the platforms a tangible volume.
    const first=Math.max(0,Math.floor((this.game.camera-x)/70)-1);
    const last=Math.min(Math.ceil(w/70),Math.ceil((this.game.camera+this.viewWidth()-x)/70)+1);
    for(let i=first;i<last;i++) {
      const n=this.hash(Math.floor(x)+i*71),xx=x+i*70;
      c.fillStyle=i%2?'#ffe6d50b':'#142b3b16';
      c.beginPath();c.moveTo(xx,y+15);c.lineTo(xx+24,y+45+n%50);
      c.lineTo(xx+64,y+130);c.lineTo(xx+40,y+240);c.lineTo(xx-12,y+240);c.closePath();c.fill();
      c.strokeStyle='#ecd0ab26';c.lineWidth=1.5;c.beginPath();c.moveTo(xx+10,y+17);
      c.bezierCurveTo(xx-2,y+45,xx+34,y+55,xx+17,y+88+n%35);c.stroke();
      for(let j=0;j<4;j++)this.ellipse(xx+n%(50+j),y+40+j*39,2.8,1.3,'#e9cdbb26');
    }
    const moss=c.createLinearGradient(0,y,0,y+21);
    moss.addColorStop(0,palette[0]);moss.addColorStop(.5,palette[1]);moss.addColorStop(1,palette[2]);
    c.fillStyle=moss;c.fillRect(x,y,w,23);
    c.strokeStyle='#fff5d77d';c.lineWidth=1.6;c.beginPath();c.moveTo(x+7,y+2);c.lineTo(x+w-7,y+2);c.stroke();
    for(let i=Math.max(0,Math.floor((this.game.camera-x)/19));i<Math.min(w/19,(this.game.camera+this.viewWidth()-x)/19+1);i++) {
      const xx=x+9+i*19,n=this.hash(i+Math.floor(x));
      this.ellipse(xx,y+19+n%7,5,3,palette[1]);
      c.strokeStyle=palette[0];c.lineWidth=1.8;c.beginPath();c.moveTo(xx,y+5);
      c.quadraticCurveTo(xx-5,y-4,xx+Math.sin(t+i)*2,y-5-n%7);c.stroke();
    }
    c.restore();
    // Wisps of roots along exposed edges emphasize actual pit boundaries.
    c.strokeStyle=palette[1];c.lineWidth=2;
    for(const edge of [x+3,x+w-3]) {
      c.beginPath();c.moveTo(edge,y+9);c.bezierCurveTo(edge+6,y+30,edge-8,y+42,edge+1,y+61);c.stroke();
      this.ellipse(edge-3,y+28,4,2,palette[0]);
    }
  }
  hero(p,t,hero=false,opacity=1) {
    const image=this.assets.images.spirit;
    if(!image)return false;
    const c=this.ctx, speed=Math.abs(p.vx||0);
    let frame=p.dash>0?7:!p.grounded&&!hero?(p.vy<0?5:6):speed>12?1+Math.floor((p.walk||0)*1.4)%4:0;
    const cw=image.width/4,ch=image.height/2;
    const anchor=[.94,.95,.94,.95,.91,.91,.96,.86][frame];
    const size=100*(p.w/34),sx=1+(p.squash||0),sy=1-(p.squash||0);
    c.save();c.translate(p.x+p.w/2,p.y+p.h);
    this.ellipse(0,3,p.w*.72,4,'#172c432f');
    c.scale((p.facing||1)*sx,sy);
    if(p.invincible>0&&!hero&&Math.sin(t*27)>0)c.globalAlpha=.58;
    c.globalAlpha*=opacity;
    if(p.flight>0){c.shadowColor='#e9d5ff';c.shadowBlur=this.game.settings.quality==='low'?0:15;}
    const breath=p.grounded?Math.sin(t*2.4)*.012:0;
    c.scale(1-breath,1+breath);
    c.drawImage(image,(frame%4)*cw,Math.floor(frame/4)*ch,cw,ch,-size*.6,-size*anchor,size,size);
    c.restore();return true;
  }
  enemy(e,t) {
    const image=this.assets.images.creatures;
    if(!image)return false;
    if(e.dead&&e.squish<=0)return true;
    const c=this.ctx,rect=e.type==='flutter'?[620,0,692,570]:e.type==='spike'?[0,620,620,540]:[80,120,480,450];
    const width=e.type==='flutter'?83:e.type==='spike'?65:54,height=e.type==='flutter'?68:e.type==='spike'?57:50;
    c.save();c.translate(e.x+e.w/2,e.y+e.h);
    this.ellipse(0,3,e.w*.7,3,'#102c432b');
    if(e.dead)c.scale(1.3,Math.max(.04,e.squish/.35)*.32);
    else c.scale(1+Math.sin(e.t*(e.type==='flutter'?13:5))*.035,1-Math.sin(e.t*(e.type==='flutter'?13:5))*.035);
    if(e.type==='spike'&&e.vx>0)c.scale(-1,1);
    c.drawImage(image,...rect,-width/2,-height+2,width,height);
    c.restore();return true;
  }
  keeper(b,t) {
    if(!b||!b.active)return;
    const c=this.ctx,image=this.assets.images.creatures;
    c.save();c.translate(b.x,b.y);
    const glow=c.createRadialGradient(0,0,0,0,0,190);
    glow.addColorStop(0,b.weak?'#fff0bd59':'#b7baff38');glow.addColorStop(1,'#bccbff00');
    this.ellipse(0,0,190,190,glow);
    c.scale(.96+Math.sin(t*3)*.035,1);
    if(b.flash>0)c.globalAlpha=.45+Math.sin(t*45)*.3;
    if(image){
      // Polygon excludes the neighboring hedgehog from the original atlas.
      const dw=270,dh=230;
      c.save();c.translate(-dw/2,-dh*.54);c.scale(dw/752,dh/639);
      c.beginPath();c.moveTo(0,0);c.lineTo(752,0);c.lineTo(752,639);c.lineTo(100,639);c.lineTo(100,110);c.lineTo(0,80);c.closePath();c.clip();
      c.drawImage(image,560,560,752,639,0,0,752,639);c.restore();
    }else this.star(0,0,80,'#dec5eb',t*.1,5);
    for(let i=0;i<b.hp;i++){const a=t*.5+i*6.283/5;this.star(Math.cos(a)*130,Math.sin(a)*82,8,'#fff0bb',a,4);}
    c.restore();
    for(const shot of b.shots){c.save();c.shadowColor='#d0b8f8';c.shadowBlur=this.game.settings.quality==='low'?0:13;this.star(shot.x,shot.y,9,'#d7b6f1',t*3,4);this.ellipse(shot.x,shot.y,3,3,'#ffeddd');c.restore();}
  }
  gate(x,t,open) {
    const c=this.ctx,y=576;
    c.save();c.translate(x,y);
    const glow=c.createRadialGradient(0,-60,1,0,-60,130);
    glow.addColorStop(0,open?'#fff1c66c':'#d7c6ef29');glow.addColorStop(1,'#fff1c600');
    this.ellipse(0,-60,130,130,glow);
    c.strokeStyle='#b9bbd5';c.lineWidth=13;c.beginPath();c.moveTo(-49,0);c.lineTo(-49,-82);c.bezierCurveTo(-49,-151,49,-151,49,-82);c.lineTo(49,0);c.stroke();
    c.strokeStyle='#fff1ddbf';c.lineWidth=2;c.stroke();
    if(open){for(let i=0;i<20;i++){const n=this.hash(i+98),xx=(n%80)-40,yy=-this.mod(t*45+i*11,126);this.star(xx,yy,3,'#fff2c3',t+i);}}
    else this.star(0,-77,17,'#c6b8e5',t*.2,5);
    c.restore();
  }
  foreground(cam,t,width) {
    if(this.game.settings.quality==='low')return;
    const c=this.ctx,night=Math.floor(this.game.maxX/9600)%4===3;
    c.save();c.globalAlpha=.62;
    for(let i=Math.floor(cam*.8/390)-1;i<Math.ceil((cam*.8+width)/390)+1;i++){
      const x=i*390-cam*.8,y=700;
      for(let j=0;j<5;j++){
        const angle=-.7+j*.32+Math.sin(t*.8+i)*.025;
        c.save();c.translate(x,y);c.rotate(angle);
        c.strokeStyle=night?'#53668d':'#557c71';c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-4,-33,0,-67);c.stroke();
        for(let k=1;k<6;k++){const yy=-k*10;this.ellipse(-5,yy,8-k*.6,2.4,night?'#6b8b9d':'#779c80');this.ellipse(5,yy-3,8-k*.6,2.4,night?'#6b8b9d':'#779c80');}
        c.restore();
      }
    }
    c.restore();
  }
};
