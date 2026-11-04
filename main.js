import {firebaseConfig} from './firebase-config.js';
const $=id=>document.getElementById(id);
let db,auth,functions,callable,ready=false,submitted=false,points=[],stroke=null,drawing=false;
const canvas=$('signature'),ctx=canvas.getContext('2d');
function redraw(){const r=canvas.getBoundingClientRect();ctx.clearRect(0,0,r.width,r.height);ctx.strokeStyle='#18181e';ctx.lineWidth=2.6;ctx.lineCap='round';ctx.lineJoin='round';for(const line of points){ctx.beginPath();line.forEach(([x,y],i)=>i?ctx.lineTo(x*r.width,y*r.height):ctx.moveTo(x*r.width,y*r.height));if(line.length===1){ctx.lineTo(line[0][0]*r.width+.1,line[0][1]*r.height+.1)}ctx.stroke();}}
function resize(){const r=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(r.width*ratio));canvas.height=Math.max(1,Math.round(r.height*ratio));ctx.setTransform(ratio,0,0,ratio,0,0);redraw();}
function pos(e){const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))]}
function update(){
 const status=$('status');
 $('submitSign').disabled=submitted;
 if(submitted)return;
 if(!ready)status.textContent='Connecting to Firebase… You can draw your signature while we connect.';
 else if(points.length===0)status.textContent='Draw your signature in the white box to continue.';
 else if(!$('agree').checked)status.textContent='Tick the consent box, then tap Light a Warning.';
 else status.textContent='Ready. Tap Light a Warning to submit.';
}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);if(points.length>=40){$('status').textContent='Too many strokes. Tap CLEAR and sign again.';return;}drawing=true;stroke=[pos(e)];points.push(stroke);$('hint').hidden=true;redraw();update()});
canvas.addEventListener('pointermove',e=>{if(!drawing)return;e.preventDefault();if(points.reduce((n,s)=>n+s.length,0)>=400)return;stroke.push(pos(e));redraw();});
for(const evt of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(evt,()=>{drawing=false;stroke=null;});
$('clearSign').onclick=()=>{points=[];$('hint').hidden=false;redraw();update();};
$('agree').onchange=update;
$('openSign').onclick=()=>{if(submitted){$('success').hidden=false;return;}$('modal').hidden=false;requestAnimationFrame(resize);};
$('closeSign').onclick=()=>{$('modal').hidden=true;};
$('closeSuccess').onclick=$('done').onclick=()=>{$('success').hidden=true;};
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function showLights(ids){$('lightField').replaceChildren();$('wall').replaceChildren();ids.forEach((id,i)=>{const h=hash(id);const light=document.createElement('i');light.className='spark';light.style.left=(27+h%46)+'%';light.style.top=(52+(Math.floor(h/79)%40))+'%';light.style.animationDelay=((i%17)*.11)+'s';$('lightField').append(light);const dot=document.createElement('i');dot.className='walllight';dot.title='Anonymous campaign supporter';dot.style.animationDelay=((i%13)*.17)+'s';$('wall').append(dot);});}
async function init(){
 try {
  const [appM,authM,storeM,funcM]=await Promise.all([
   import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
   import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
   import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'),
   import('https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js')]);
  const app=appM.initializeApp(firebaseConfig);
  auth=authM.getAuth(app);db=storeM.getFirestore(app);functions=funcM.getFunctions(app,'asia-south1');callable=funcM.httpsCallable;
  await authM.signInAnonymously(auth);
  ready=true;update();$('modeNote').textContent='LIVE CAMPAIGN · PRIVATE SIGNATURES';
  storeM.onSnapshot(storeM.doc(db,'stats','campaign'),snap=>{$('count').textContent=(snap.exists()?snap.data().count:0).toLocaleString('en-IN');},()=>{$('modeNote').textContent='Unable to read the live count. Please refresh.';});
  const q=storeM.query(storeM.collection(db,'lights'),storeM.orderBy('createdAt','desc'),storeM.limit(150));
  storeM.onSnapshot(q,snap=>showLights(snap.docs.map(d=>d.id)),()=>{});
 }catch(error){console.error('Firebase initialization failed',error);ready=false;update();$('modeNote').textContent='FIREBASE CONNECTION FAILED · CHECK SETUP AND REFRESH';$('status').textContent='Firebase connection unavailable. Enable Anonymous Authentication in project one-voice-44e1f and refresh.';}
}
$('submitSign').onclick=async()=>{
 if(submitted)return;if(!ready){$('status').textContent='Not connected to Firebase yet. Check Anonymous Authentication, Firestore and your internet connection, then refresh.';return;}if(!points.length){$('status').textContent='Please draw your signature first.';return;}if(!$('agree').checked){$('status').textContent='Please check the consent box first.';return;}
 $('submitSign').disabled=true;$('status').textContent='Saving your voice…';
 try{
  const add=callable(functions,'addVoice');
  const strokes=points.map(line=>line.map(([x,y])=>[Math.round(x*1000)/1000,Math.round(y*1000)/1000]));
  await add({name:$('signName').value.trim(),strokes,consent:true});
  submitted=true;$('modal').hidden=true;$('success').hidden=false;$('openSign').textContent='YOUR VOICE IS COUNTED';$('status').textContent='';
 }catch(error){console.error('Signature save failed',error);$('status').textContent=error.code==='functions/already-exists'?'This anonymous account has already signed.':(error.message||'Unable to save. Try again.');update();}
};
$('share').onclick=async()=>{try{if(navigator.share)await navigator.share({title:'ONE VOICE · Infopark',text:'Stand for safer roads to Infopark.',url:location.href});else{await navigator.clipboard.writeText(location.href);$('share').textContent='LINK COPIED ✓';}}catch{}};
window.addEventListener('resize',()=>{if(!$('modal').hidden)resize();});init();