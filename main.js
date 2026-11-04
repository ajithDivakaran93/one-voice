import {firebaseConfig} from './firebase-config.js';
const $=id=>document.getElementById(id);
const canvas=$('signature'),context=canvas.getContext('2d');
let ready=false,submitting=false,signed=false,points=[],active=null,auth,db,functions,httpsCallable;
const message=(s)=>{$('status').textContent=s;};
const getStrokeCount=()=>points.reduce((n,line)=>n+line.length,0);
function redraw(){
 const r=canvas.getBoundingClientRect();context.clearRect(0,0,r.width,r.height);
 context.strokeStyle='#15151b';context.lineWidth=2.5;context.lineJoin='round';context.lineCap='round';
 for(const line of points){
  context.beginPath();line.forEach(([x,y],i)=>i?context.lineTo(x*r.width,y*r.height):context.moveTo(x*r.width,y*r.height));
  if(line.length===1)context.lineTo(line[0][0]*r.width+.01,line[0][1]*r.height+.01);
  context.stroke();
 }
}
function resizeSignature(){
 const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
 canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));
 context.setTransform(dpr,0,0,dpr,0,0);redraw();
}
function point(e){const r=canvas.getBoundingClientRect();return [
 Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),
 Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))
];}
function updateForm(){
 $('submitSign').disabled=submitting;
 if(submitting)return;
 if(!ready)message('Firebase is not connected. You can sign, but submission needs a connection.');
 else if(!points.length)message('Draw your signature to continue.');
 else if(!$('agree').checked)message('Check the consent box to submit.');
 else message('Ready. Tap STAND WITH US to submit your voice.');
}
canvas.addEventListener('pointerdown',e=>{
 e.preventDefault();if(points.length>=40){message('Too many strokes. Please clear and sign again.');return;}
 canvas.setPointerCapture(e.pointerId);active=[point(e)];points.push(active);$('hint').hidden=true;redraw();updateForm();
});
canvas.addEventListener('pointermove',e=>{
 if(!active)return;e.preventDefault();if(getStrokeCount()>=400)return;
 active.push(point(e));redraw();
});
for(const event of ['pointerup','pointercancel','lostpointercapture']){
 canvas.addEventListener(event,()=>{active=null;});
}
$('clearSign').onclick=()=>{points=[];active=null;$('hint').hidden=false;redraw();updateForm();};
$('agree').addEventListener('change',updateForm);
function setDialog(node,show){
 node.hidden=!show;document.body.style.overflow=(!$('modal').hidden||!$('success').hidden)?'hidden':'';
 if(show)requestAnimationFrame(()=>{if(node===$('modal'))resizeSignature();});
}
$('openSign').onclick=()=>{if(signed){setDialog($('success'),true);return;}setDialog($('modal'),true);};
$('closeSign').onclick=()=>setDialog($('modal'),false);
$('closeSuccess').onclick=$('done').onclick=()=>setDialog($('success'),false);
for(const id of ['modal','success'])$(id).addEventListener('click',e=>{if(e.target===$(id))setDialog($(id),false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){setDialog($('modal'),false);setDialog($('success'),false);}});
addEventListener('resize',()=>{if(!$('modal').hidden)resizeSignature();});
function drawPeople(ids){
 const wall=document.createDocumentFragment();
 ids.slice(0,140).forEach((id,i)=>{
  // Decorative illustrations only; no signature or person's name is exposed.
  const person=document.createElement('span');
  person.className='supporter';person.setAttribute('aria-hidden','true');
  person.style.setProperty('--delay',((i%17)*-.13)+'s');
  for(const part of ['head','body','arm-left','arm-right','leg-left','leg-right']){
   const shape=document.createElement('span');shape.className='supporter-'+part;person.append(shape);
  }
  wall.append(person);
 });
 $('wall').replaceChildren(wall);
 window.OneVoiceRoad?.setSupporters(ids);
}
function updateCount(value){const shown=Number.isFinite(value)?value.toLocaleString('en-IN'):'—';$('count').textContent=shown;$('countMirror').textContent=shown;}
function showConnected(text){const status=document.getElementById('connectionStatus');if(status)status.textContent=text;}
function markSigned(){
 signed=true;sessionStorage.setItem('oneVoiceSigned','true');
 window.OneVoiceRoad?.celebrate();
 $('openSign').innerHTML='VOICE ADDED <span>✓</span>';
 setDialog($('modal'),false);setDialog($('success'),true);
}
async function shareCampaign(){
 const url=location.origin+location.pathname;
 try{
  if(navigator.share){await navigator.share({title:'ONE VOICE · INFOPARK',text:'Enough is enough. Join the call for safer roads around Infopark.',url});}
  else if(navigator.clipboard){await navigator.clipboard.writeText(url);$('shareCampaign').textContent='LINK COPIED ✓';}
  else{location.href='https://wa.me/?text='+encodeURIComponent('Join ONE VOICE: '+url);}
 }catch(e){if(e?.name!=='AbortError')console.warn('Share unavailable',e);}
}
$('share').onclick=shareCampaign;
$('shareCampaign').onclick=shareCampaign;
$('submitSign').onclick=async()=>{
 if(submitting)return;
 if(!ready){message('Firebase connection unavailable. Refresh the page and check your internet connection.');return;}
 if(!points.length){message('Please draw your signature first.');return;}
 if(!$('agree').checked){message('Please accept the consent checkbox.');return;}
 submitting=true;updateForm();$('submitSign').innerHTML='SAVING YOUR VOICE…';
 message('Submitting securely. Do not close the page.');
 try{
  const addVoice=httpsCallable(functions,'addVoice');
  const strokes=points.map(line=>line.map(([x,y])=>[Math.round(x*1000)/1000,Math.round(y*1000)/1000]));
  await addVoice({name:$('signName').value.trim(),strokes,consent:true});
  markSigned();
 }catch(error){
  console.error('Signature submission failed:',error);
  if(error.code==='functions/already-exists'){
   markSigned();
  }else{
   const detail=error.code==='functions/not-found'?'Signature service is not deployed. An organizer must deploy Cloud Functions.':
    error.code==='functions/unauthenticated'?'Sign-in failed. Please reload the page.':
    error.code==='functions/resource-exhausted'?'Too many requests. Please try again later.':
    'Could not save the signature. Please retry or contact the organizers.';
   message(detail);
  }
 }finally{
  submitting=false;$('submitSign').innerHTML='STAND WITH US <span>↗</span>';
  if(!signed)updateForm();
 }
};
async function init(){
 if(sessionStorage.getItem('oneVoiceSigned')==='true'){signed=true;$('openSign').innerHTML='VOICE ADDED <span>✓</span>';}
 try{
  const [appM,authM,storeM,functionsM]=await Promise.all([
   import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
   import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
   import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js'),
   import('https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js')
  ]);
  const app=appM.initializeApp(firebaseConfig);
  auth=authM.getAuth(app);
  db=storeM.getFirestore(app);
  functions=functionsM.getFunctions(app,'asia-south1');
  httpsCallable=functionsM.httpsCallable;
  await authM.signInAnonymously(auth);
  ready=true;updateForm();
  storeM.onSnapshot(storeM.doc(db,'stats','campaign'),snapshot=>{
   updateCount(snapshot.exists()?Number(snapshot.data().count)||0:0);
  },error=>{console.warn('Counter subscription failed',error);updateCount(NaN);});
  const q=storeM.query(storeM.collection(db,'lights'),storeM.orderBy('createdAt','desc'),storeM.limit(140));
  storeM.onSnapshot(q,snapshot=>drawPeople(snapshot.docs.map(doc=>doc.id)),
   error=>{console.warn('Lights subscription failed',error);});
 }catch(error){
  console.error('Firebase setup failed:',error);
  ready=false;updateForm();
  message('Unable to connect to the campaign. Ask an organizer to check Firebase Authentication.');
 }
}
init();
