// ONE VOICE: cinematic moving road with a human solidarity corridor.
// Dim red silhouettes are symbolic scenery, not counted signatures.
// Brighter silhouettes correspond only to genuine saved submissions.
(() => {
 const canvas=document.getElementById('cinematicRoad');
 if(!canvas)return;
 const scene=canvas.parentElement,ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let w=1,h=1,dpr=1,frame=0,last=0,travel=0,ids=[],entry=null;
 const hash=id=>{let n=2166136261;for(let i=0;i<id.length;i++){n^=id.charCodeAt(i);n=Math.imul(n,16777619);}return n>>>0;};
 const center=()=>w*.5;
 const horizon=()=>h*.36;
 const project=(depth)=>{const p=Math.pow(depth,1.7);return {p,y:horizon()+p*h*.83,half:w*(.018+p*.52)}};
 const poly=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach((a,i)=>i?ctx.lineTo(...a):ctx.moveTo(...a));ctx.closePath();ctx.fill();};
 const ellipse=(x,y,rx,ry,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);ctx.fill();};
 function person(x,y,scale,seed,t,side,highlight=false,symbolic=false,arrival=1){
   // Stationary silhouette: only the inward fist raises and lowers.
   const mobile=w<700;
   const height=clamp(23+scale*(mobile?37:58),22,mobile?46:70);
   const head=height*.105, neck=y-height*.77, shoulderY=y-height*.70;
   const hipY=y-height*.34, torsoWidth=height*.23;
   const color=highlight?'#ffe3e6':(symbolic?'#ed3452':'#ff7189');
   const motion=reduce.matches?0:(.5+.5*Math.sin(t*1.8+seed*.19));
   const protestMotion=highlight?1:motion;
   const sway=0;
   const limb=Math.max(2.2,height*.082);
   ctx.save();ctx.globalAlpha=(symbolic ? 0.76 : 1)*arrival;
   ctx.lineJoin='round';ctx.lineCap='round';
   const glow=ctx.createRadialGradient(x,shoulderY,0,x,shoulderY,height*.6);
   glow.addColorStop(0,symbolic?'#f9284b30':'#ff406977');
   glow.addColorStop(1,'#f9284b00');
   ellipse(x,shoulderY,height*.6,height*.65,glow);
   ellipse(x,y,height*.16,height*.04,'#030306bb');
   // Standing stance: legs and feet remain planted, while only the
   // inward arm raises and lowers in protest.
   ctx.strokeStyle=color;ctx.lineWidth=limb;
   ctx.beginPath();
   ctx.moveTo(x-torsoWidth*.2,hipY);
   ctx.lineTo(x-height*.075,y-height*.10);
   ctx.lineTo(x-height*.14,y);
   ctx.moveTo(x+torsoWidth*.2,hipY);
   ctx.lineTo(x+height*.075,y-height*.10);
   ctx.lineTo(x+height*.14,y);
   ctx.stroke();
   // Solid jacket / shoulders and narrow waist.
   poly([[x-torsoWidth*.67+sway,shoulderY],
         [x+torsoWidth*.67+sway,shoulderY],
         [x+torsoWidth*.43,hipY],
         [x-torsoWidth*.43,hipY]],color);
   // Outer arm down and slightly out.
   ctx.beginPath();
   ctx.moveTo(x+side*torsoWidth*.68,shoulderY+height*.02);
   ctx.lineTo(x+side*height*.20,y-height*.43);
   ctx.stroke();
   // Inner arm raises a clenched fist: elbow and hand have distinct positions.
   // On the left of the road the right-facing arm lifts, mirrored on the right.
   const inward=-side;
   const shoulderX=x+inward*torsoWidth*.65;
   const elbowX=x+inward*(height*.19+protestMotion*height*.025);
   const elbowY=shoulderY-height*(.015+protestMotion*.10);
   const fistX=x+inward*(height*.15+protestMotion*height*.065);
   const fistY=shoulderY-height*(.10+protestMotion*.23);
   ctx.beginPath();ctx.moveTo(shoulderX,shoulderY+height*.02);
   ctx.lineTo(elbowX,elbowY);ctx.lineTo(fistX,fistY);
   ctx.stroke();
   ellipse(fistX,fistY,limb*.75,limb*.78,color);
   // Separate round head with short neck makes the figure identifiable.
   ctx.fillStyle=color;
   ctx.fillRect(x-height*.025,neck-height*.015,height*.05,height*.07);
   ellipse(x+sway,neck-head*.42,head,head*1.08,color);
   if(highlight)ellipse(x,shoulderY,height*.34,height*.34,'#fff0f42f');
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
   // Balanced human vigil: use fixed screen-space slots instead of equally
   // spaced perspective depths. This avoids bunching at the near end.
   // Four symbolic figures are not counted as supporters; they set the scene.
   // Actual submissions occupy separate vacant slots (up to 8 on mobile).
   const mobile=w<700,figures=[];
   const rows=mobile?9:11;
   const yStart=mobile?.44:.42,yEnd=mobile?.88:.89;
   const pForY=portion=>clamp((portion-.36)/.83,.035,.95);
   const actualPerSide=Math.min(Math.ceil(ids.length/2),mobile?4:5);
   for(const side of [-1,1]){
     let added=0;
     for(let slot=0;slot<rows;slot++){
       // Real supporters fill alternating gaps between symbolic figures.
       const realSlot=(slot%2===0 && slot<rows-1);
       const portion=yStart+(yEnd-yStart)*(slot/(rows-1));
       const p=pForY(portion),z=Math.pow(p,1/1.7);
       const shoulderMargin=mobile?9:14;
       const x=clamp(mid+side*(project(z).half+shoulderMargin),mobile?29:40,w-(mobile?29:40));
       const y=h*portion;
       if(realSlot && added<actualPerSide){
         const index=added*2+(side===-1?0:1);
         if(index<ids.length){
           const id=ids[index];
           added++;
           // During the entry celebration the new signer gets a single,
           // unobstructed foreground position, not a duplicate behind text.
           if(entry?.id===id&&t-entry.start<6)continue;
           figures.push({x,y,z,scale:p,seed:hash(id),side,symbolic:false,highlight:false,id});
           continue;
         }
       }
       // Only populate a sparse symbolic line: every other slot and the
       // bottom-most position, keeping the near-side road visually occupied.
       if(slot%2===1 || slot===rows-1){
         figures.push({x,y,z,scale:p,seed:slot*71+(side===-1?7:13),side,symbolic:true,highlight:false});
       }
     }
   }
   // New signer is spotlighted in a prominent stationary foreground slot.
   if(entry && t-entry.start<6){
     const p=.46,z=Math.pow(p,1/1.7),side=-1;
     const x=clamp(mid-(project(z).half+(mobile?9:14)),mobile?29:40,w-(mobile?29:40));
     figures.push({x,y:h*.71,z,scale:p,seed:hash(entry.id),side,symbolic:false,highlight:true,id:entry.id});
   }
   figures.sort((a,b)=>a.y-b.y);
   for(const item of figures){
     let x=item.x,y=item.y,opacity=1;
     if(item.highlight && entry){
       const elapsed=Math.max(0,t-entry.start);
       // New signers appear already standing in their place. Highlight
       // without sliding, walking or moving their body.
       const strength=Math.max(0,1-elapsed/5.5);
       ctx.save();
       // A soft spotlight from the person's feet, plus a pulsing ring.
       ctx.globalAlpha=strength*.68;
       const beam=ctx.createRadialGradient(x,y-item.scale*15,0,x,y-item.scale*15,mobile?65:100);
       beam.addColorStop(0,'#ffbdce7a');beam.addColorStop(.26,'#ff355a49');beam.addColorStop(1,'#ff355a00');
       ellipse(x,y-item.scale*15,mobile?65:100,mobile?85:110,beam);
       if(!reduce.matches){
         ctx.strokeStyle='#ffb2c8';ctx.lineWidth=2;
         ctx.globalAlpha=strength*.65;
         const radius=(mobile?16:23)+((elapsed*18)%(mobile?46:67));
         ctx.beginPath();ctx.arc(x,y-item.scale*19,radius,0,Math.PI*2);ctx.stroke();
       }
       ctx.restore();
     }
     person(x,y,item.scale,item.seed,t,item.side,item.highlight,item.symbolic,opacity);
   }
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
   celebrate(id){if(typeof id!=='string'||!id)return;entry={id,start:performance.now()/1000};render(performance.now()/1000);}
 };
 window.addEventListener('resize',resize);
 document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
 reduce.addEventListener?.('change',()=>render(performance.now()/1000));
 resize();start();
})();
