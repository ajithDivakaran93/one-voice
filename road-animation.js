// Perspective road animation, deliberately independent of Firebase.
const canvas = document.getElementById('cinematicRoad');
const scene = canvas?.parentElement;
if (canvas && scene) {
  const ctx = canvas.getContext('2d', {alpha:false});
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let w=1,h=1,dpr=1,last=0,travel=0,raf=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function resize(){
    const r=scene.getBoundingClientRect();
    w=Math.max(1,r.width);h=Math.max(1,r.height);
    dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    paint();
  }
  const horizon=()=>h*.29;
  const depth=(z)=>{ // z=0 distant, z=1 nearby
    const p=Math.pow(z,1.85),y=horizon()+p*h*.87;
    return {p,y,half:w*(.017 + p*.87)};
  };
  function polygon(a,fill){
    ctx.beginPath();ctx.moveTo(a[0][0],a[0][1]);
    for(let i=1;i<a.length;i++)ctx.lineTo(a[i][0],a[i][1]);
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  }
  function bulb(x,y,size,opacity){
    ctx.save();ctx.globalAlpha=opacity;
    const glow=ctx.createRadialGradient(x,y,0,x,y,size*9);
    glow.addColorStop(0,'#fff6ee');glow.addColorStop(.04,'#ff5e65');
    glow.addColorStop(.2,'#ef173855');glow.addColorStop(1,'#ff183500');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,size*9,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ff6b76';ctx.fillRect(x-size*.65,y-size*1.6,size*1.3,size*3.2);
    ctx.restore();
  }
  function paint(){
    if(!w||!h)return;
    const hy=horizon(),center=w*.5;
    const sky=ctx.createLinearGradient(0,0,0,h);
    sky.addColorStop(0,'#040507');sky.addColorStop(.42,'#10070d');sky.addColorStop(.74,'#210710');sky.addColorStop(1,'#070608');
    ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    let fog=ctx.createRadialGradient(center,hy,0,center,hy,w*.85);
    fog.addColorStop(0,'#c9193568');fog.addColorStop(.27,'#80112727');fog.addColorStop(1,'#00000000');
    ctx.fillStyle=fog;ctx.fillRect(0,hy-w*.8,w,w*1.7);
    const far=depth(0),near=depth(1);
    polygon([[center-far.half,far.y],[center+far.half,far.y],[center+near.half,near.y],[center-near.half,near.y]],'#18191d');
    const asphalt=ctx.createLinearGradient(0,hy,0,h);
    asphalt.addColorStop(0,'#262027');asphalt.addColorStop(.45,'#222026');asphalt.addColorStop(1,'#101014');
    polygon([[center-far.half,far.y],[center+far.half,far.y],[center+near.half,near.y],[center-near.half,near.y]],asphalt);
    for(let side of [-1,1]){
      polygon([[center+side*far.half,far.y],[center+side*(far.half+1),far.y],[center+side*(near.half+6),near.y],[center+side*near.half,near.y]],'#ff6677');
    }
    // Traveling white dashed centerline; segments grow as they approach.
    for(let i=0;i<22;i++){
      let z=((i/22+travel*.17)%1),e=((i/22+travel*.17+.024)%1);
      if(e<z)continue;
      let a=depth(z),b=depth(e);
      let aw=Math.max(.5,1+a.p*7),bw=Math.max(1,1+b.p*9);
      polygon([[center-aw,a.y],[center+aw,a.y],[center+bw,b.y],[center-bw,b.y]],'#e7d9ce');
      polygon([[center-aw*.35,a.y],[center+aw*.35,a.y],[center+bw*.35,b.y],[center-bw*.35,b.y]],'#fff9e8');
    }
    // Red emergency posts stream forward along the outer road shoulders.
    for(let i=0;i<14;i++){
      const z=(i/14+travel*.10)%1;
      const q=depth(z);
      for(let side of [-1,1]){
        let x=center+side*(q.half+w*(.027+q.p*.028));
        let size=1.2+q.p*8;
        ctx.strokeStyle='#481722';ctx.lineWidth=1+q.p*3;
        ctx.beginPath();ctx.moveTo(x,q.y);ctx.lineTo(x,q.y-8-q.p*35);ctx.stroke();
        bulb(x,q.y-8-q.p*35,size,clamp(.6+Math.sin(travel*5+i*.9+side)*.3,.3,1));
        // Reflection on wet asphalt, increasing with depth.
        const alpha=.04+q.p*.18;
        const reflection=ctx.createLinearGradient(x,q.y,x,q.y+q.p*55);
        reflection.addColorStop(0,'rgba(255,44,63,'+alpha+')');
        reflection.addColorStop(1,'rgba(255,44,63,0)');
        ctx.fillStyle=reflection;ctx.fillRect(x-size*.7,q.y,size*1.4,q.p*55);
      }
    }
    // Narrow red warning sweep across the horizon.
    let pulse=.12+.10*Math.sin(travel*3);
    ctx.fillStyle='rgba(255,35,58,'+pulse+')';
    ctx.fillRect(0,hy-1,w,2);
    // vignette to keep overlaid headline and CTA legible
    let vignette=ctx.createLinearGradient(0,0,0,h);
    vignette.addColorStop(0,'#05050755');vignette.addColorStop(.22,'#05050730');
    vignette.addColorStop(.58,'#00000000');vignette.addColorStop(1,'#05050788');
    ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  }
  function tick(t){
    if(document.hidden){raf=0;return;}
    const dt=last?Math.min((t-last)/1000,.05):0;last=t;
    if(!reduced.matches)travel+=dt*.73;
    paint();raf=requestAnimationFrame(tick);
  }
  function start(){if(!raf){last=0;raf=requestAnimationFrame(tick);}}
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;}
  addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start();});
  reduced.addEventListener?.('change',()=>{paint();});
  resize();start();
}
