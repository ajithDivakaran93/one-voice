// ONE VOICE: cinematic moving road with a human solidarity corridor.
// Dim red silhouettes are symbolic scenery, not counted signatures.
// Brighter silhouettes correspond only to genuine saved submissions.
(() => {
 const canvas=document.getElementById('cinematicRoad');
 if(!canvas)return;
 const scene=canvas.parentElement,ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let w=1,h=1,dpr=1,frame=0,last=0,travel=0,ids=[],flashUntil=0;
 const hash=id=>{let n=2166136261;for(let i=0;i<id.length;i++){n^=id.charCodeAt(i);n=Math.imul(n,16777619);}return n>>>0;};
 const center=()=>w*.5;
 const horizon=()=>h*.36;
 const project=(depth)=>{const p=Math.pow(depth,1.7);return {p,y:horizon()+p*h*.83,half:w*(.018+p*.52)}};
 const poly=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach((a,i)=>i?ctx.lineTo(...a):ctx.moveTo(...a));ctx.closePath();ctx.fill();};
 const ellipse=(x,y,rx,ry,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);ctx.fill();};
 function person(x,y,scale,seed,t,side,highlight=false,symbolic=false){
   // Protective human silhouette: head, jacket, legs and an outward, raised arm.
   const height=clamp(12+scale*(w<700?34:48),10,w<700?38:52),head=Math.max(2,height*.095),shoulder=height*.12;
   const foot=y,hip=y-height*.35,chest=y-height*.69,neck=y-height*.83;
   const sway=Math.sin(t*1.2+seed*.03)*height*.011;
   const bright=highlight?'#ffd2dc':(symbolic?'#c72440':'#ff526e');
   ctx.save();ctx.globalAlpha=symbolic?.57:1;
   const glow=ctx.createRadialGradient(x,chest,0,x,chest,height*.9);
   glow.addColorStop(0,symbolic?'#d91d3b26':'#ff315a7a');glow.addColorStop(1,'#d91d3b00');
   ellipse(x,chest,height*.9,height*.9,glow);
   ellipse(x,foot+1,height*.15,height*.035,'#0009');
   ctx.lineCap='round';ctx.lineJoin='round';
   ctx.strokeStyle=bright;ctx.lineWidth=Math.max(1.7,height*.10);
   ctx.beginPath();ctx.moveTo(x-height*.052,hip);ctx.lineTo(x-height*.075,foot);
   ctx.moveTo(x+height*.052,hip);ctx.lineTo(x+height*.08,foot);ctx.stroke();
   poly([[x-shoulder+sway,chest],[x+shoulder+sway,chest],[x+height*.095,hip],[x-height*.095,hip]],bright);
   // arm pointing inward to protect the road / link the protest line
   ctx.strokeStyle=bright;ctx.lineWidth=Math.max(1.6,height*.067);
   ctx.beginPath();ctx.moveTo(x-side*shoulder*.85,chest+height*.04);
   ctx.lineTo(x-side*height*.21,chest-height*.05);
   ctx.lineTo(x-side*height*.29,chest-height*.12);ctx.stroke();
   // outer arm slightly down
   ctx.beginPath();ctx.moveTo(x+side*shoulder*.85,chest+height*.02);
   ctx.lineTo(x+side*height*.17,hip+height*.08);ctx.stroke();
   ellipse(x+sway,neck-head*.6,head,head*1.12,bright);
   // subtle shadow/hair: stylized, not a portrait
   ellipse(x+sway,neck-head*1.19,head*.89,head*.36,bright);
   if(highlight){ellipse(x,chest,height*.8,height*.8,'#ff758425');}
   ctx.restore();
 }
 function clamp(v,a,b){return Math.min(b,Math.max(a,v));}
 function render(t){
   const mid=center(),hy=horizon();
   const sky=ctx.createLinearGradient(0,0,0,h);
   sky.addColorStop(0,'#040508');sky.addColorStop(.46,'#0d1018');sky.addColorStop(.8,'#1a111a');sky.addColorStop(1,'#07070b');
   ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
   const mist=ctx.createRadialGradient(mid,hy,4,mid,hy,w*.8);
   mist.addColorStop(0,'#c431474e');mist.addColorStop(.32,'#62313a28');mist.addColorStop(1,'#00000000');
   ctx.fillStyle=mist;ctx.fillRect(0,hy-w*.7,w,w*1.6);
   const a=project(0),b=project(1);
   poly([[mid-a.half,a.y],[mid+a.half,a.y],[mid+b.half,b.y],[mid-b.half,b.y]],'#17181d');
   const asphalt=ctx.createLinearGradient(0,hy,0,h);
   asphalt.addColorStop(0,'#2c2830');asphalt.addColorStop(.6,'#25232a');asphalt.addColorStop(1,'#111218');
   poly([[mid-a.half,a.y],[mid+a.half,a.y],[mid+b.half,b.y],[mid-b.half,b.y]],asphalt);
   for(const side of [-1,1]){
     poly([[mid+side*a.half,a.y],[mid+side*(a.half+1),a.y],[mid+side*(b.half+5),b.y],[mid+side*b.half,b.y]],'#b94c5a');
   }
   // center markings travel toward camera continuously
   for(let i=0;i<22;i++){
     const z=(i/22+travel*.16)%1,e=z+.027;if(e>1)continue;
     const p=project(z),q=project(e);
     poly([[mid-1-p.p*6,p.y],[mid+1+p.p*6,p.y],[mid+1+q.p*8,q.y],[mid-1-q.p*8,q.y]],'#d8d4cd');
   }
   // The symbolic crowd exists from the first load and is deliberately
   // excluded from the live counter. Small red people hug the road edges.
   const mobile=w<700,figures=[];
   const basePerSide=mobile?18:24;
   for(const side of [-1,1]){
     for(let slot=0;slot<basePerSide;slot++){
       const z=clamp(.80-slot*(mobile?.032:.026),.12,.80),p=project(z);
       const margin=mobile?9:14;
       const x=clamp(mid+side*(p.half+(mobile?5:9)),margin,w-margin);
       const y=clamp(p.y,h*.42,h*(mobile?.79:.87));
       figures.push({x,y,z,scale:p.p,seed:slot*31+(side===-1?7:13),side,symbolic:true,highlight:false});
     }
   }
   // Real signers use the same corridor but shine brighter. Newest near front.
   for(let i=0;i<Math.min(ids.length,80);i++){
     const side=i%2===0?-1:1,slot=Math.floor(i/2);
     const z=clamp(.76-slot*.020,.14,.76),p=project(z);
     const margin=mobile?9:14;
     const x=clamp(mid+side*(p.half+(mobile?10:15)),margin,w-margin);
     const y=clamp(p.y,h*.42,h*(mobile?.79:.87));
     figures.push({x,y,z,scale:p.p,seed:hash(ids[i]),side,symbolic:false,highlight:i===0&&t<flashUntil});
   }
   figures.sort((a,b)=>a.z-b.z);
   for(const item of figures)person(item.x,item.y,item.scale,item.seed,t,item.side,item.highlight,item.symbolic);
   // atmospheric foreground vignette
   const vignette=ctx.createLinearGradient(0,0,0,h);
   vignette.addColorStop(0,'#05050877');vignette.addColorStop(.25,'#05050827');
   vignette.addColorStop(.70,'#00000000');vignette.addColorStop(1,'#05050866');
   ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
 }
 function resize(){
   const box=scene.getBoundingClientRect();w=Math.max(1,box.width);h=Math.max(1,box.height);
   dpr=Math.min(devicePixelRatio||1,2);
   canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
   ctx.setTransform(dpr,0,0,dpr,0,0);render(performance.now()/1000);
 }
 function tick(now){
   if(document.hidden){frame=0;return;}
   const dt=last?Math.min((now-last)/1000,.05):0;last=now;
   if(!reduce.matches)travel+=dt*.65;
   render(now/1000);frame=requestAnimationFrame(tick);
 }
 const start=()=>{if(!frame){last=0;frame=requestAnimationFrame(tick);}};
 const stop=()=>{if(frame)cancelAnimationFrame(frame);frame=0;};
 window.OneVoiceRoad={
   setSupporters(next){ids=Array.isArray(next)?next.slice(0,80):[];render(performance.now()/1000);},
   celebrate(){flashUntil=performance.now()/1000+4;}
 };
 window.addEventListener('resize',resize);
 document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
 reduce.addEventListener?.('change',()=>render(performance.now()/1000));
 resize();start();
})();
