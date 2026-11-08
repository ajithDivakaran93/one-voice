import {firebaseConfig} from './firebase-config.js';
const $=id=>document.getElementById(id);
const canvas=$('signature'),context=canvas.getContext('2d');
let ready=false,submitting=false,signed=false,points=[],active=null,auth,db,functions,httpsCallable,signInAnonymously;let recentSupporterIds=[],pendingOwnId=null,pendingOwnName='',publicNamesById=new Map();
let storeApi=null,directoryRows=[],directoryCursor=null,directoryBusy=false,directoryDone=false,directoryError='',directoryLoaded=false;
let latestPageDocs=[],olderPageDocs=[],popupPageDocs=null,directoryRevision=0,stopPopupListener=null;
let legacyCount=null,shardsCount=null,legacyLoaded=false,shardsLoaded=false;
// Server-confirmed submissions stay in a local reconciliation layer until
// Firestore delivers both the directory row and its separate stats snapshot.
let confirmedLocal=null,serverCount=null,pendingCountFloor=null;
const liveRecentIds=new Set();
function visibleRecentRows(){
 const rows=latestPageDocs.slice();
 if(confirmedLocal&&!rows.some(row=>row.id===confirmedLocal.id))
   rows.unshift(confirmedLocal);
 return rows.slice(0,60);
}
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
 else if(!$('signName').value.trim())message('Enter your full name to continue.');
 else if(!points.length)message('Draw your signature to continue.');
 else if(!$('showName').checked)message('Agree to show your name in the supporters list.');
 else if(!$('agree').checked)message('Check the campaign consent box to submit.');
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
$('showName').addEventListener('change',updateForm);
$('signName').addEventListener('input',updateForm);
function setDialog(node,show){
 if(node===$('supportersModal')){
  if(show)startPopupListener();
  else closePopupListener();
 }
 node.hidden=!show;document.body.style.overflow=['modal','supportersModal','petitionModal'].some(id=>!$(id).hidden)?'hidden':'';
 if(show)requestAnimationFrame(()=>{if(node===$('modal'))resizeSignature();});
}
$('openSign').onclick=()=>{if(signed){setDialog($('success'),true);return;}setDialog($('modal'),true);};
$('viewSupporters').onclick=()=>{setDialog($('supportersModal'),true);renderSupporters();};
$('viewAllSupporters').onclick=()=>{$('viewSupporters').click();};
$('moreSupporters').onclick=()=>loadSupporterPage();
$('viewPetition').onclick=()=>setDialog($('petitionModal'),true);
$('closeSupporters').onclick=()=>setDialog($('supportersModal'),false);
$('closePetition').onclick=()=>setDialog($('petitionModal'),false);
$('petitionSign').onclick=()=>{setDialog($('petitionModal'),false);$('openSign').click();};
$('closeSign').onclick=()=>setDialog($('modal'),false);
$('closeSuccess').onclick=$('done').onclick=()=>setDialog($('success'),false);
for(const id of ['modal','success','supportersModal','petitionModal'])$(id).addEventListener('click',e=>{if(e.target===$(id))setDialog($(id),false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){setDialog($('modal'),false);setDialog($('success'),false);setDialog($('supportersModal'),false);setDialog($('petitionModal'),false);}});
addEventListener('resize',()=>{if(!$('modal').hidden)resizeSignature();});
function drawPeople(ids){
 recentSupporterIds=Array.from(new Set([...(pendingOwnId?[pendingOwnId]:[]),...ids])).slice(0,140);
 const wall=document.createDocumentFragment();
 recentSupporterIds.forEach((id,i)=>{
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
 window.OneVoiceRoad?.setSupporters(recentSupporterIds.map(id=>({id,name:id===pendingOwnId&&pendingOwnName?pendingOwnName:(publicNamesById.get(id)||'')})));
}
// The first page uses a persistent Firestore snapshot, so new signatures
// appear in the list immediately without reopening or refreshing the dialog.
function renderLatestSupporters(){
 const list=$('latestSupporters');
 if(!list)return;
 list.replaceChildren();
 const recent=visibleRecentRows().slice(0,10);
 if(!recent.length){
  const li=document.createElement('li');
  li.className='latest-placeholder';
  li.textContent=directoryError||(!directoryLoaded?'Connecting to supporters…':'Be the first to add your voice.');
  list.append(li);
  return;
 }
 recent.forEach((item,index)=>{
  const li=document.createElement('li');
  if(!item.name)li.className='anonymous-entry';
  const number=document.createElement('span');
  number.className='latest-number';
  number.textContent=String(index+1).padStart(2,'0');
  const name=document.createElement('span');
  name.className='latest-name';
  name.textContent=item.name||'Anonymous supporter';
  li.append(number,name);
  list.append(li);
 });
}
function rebuildDirectory(){
 const byId=new Map();
 for(const doc of [...olderPageDocs,...(popupPageDocs||[]),...latestPageDocs,...(confirmedLocal?[confirmedLocal]:[])])byId.set(doc.id,doc);
 directoryRows=Array.from(byId.values()).sort((a,b)=>{
  const at=a.createdAt?.toMillis?.()||0,bt=b.createdAt?.toMillis?.()||0;
  return bt-at || a.id.localeCompare(b.id);
 });
 renderSupporters();
 renderLatestSupporters();
}
function renderSupporters(){
 $('supporterTotal').textContent=$('count').textContent;
 const list=$('supporterNames');list.replaceChildren();
 if(directoryRows.length){
  const ol=document.createElement('ol');ol.className='name-list';
  for(const item of directoryRows){
   const li=document.createElement('li');
   li.textContent=item.name||'Anonymous supporter';
   if(!item.name)li.className='anonymous-entry';
   ol.append(li);
  }
  list.append(ol);
 }else{
  const p=document.createElement('p');p.className='empty-supporters';
  p.textContent=directoryError||(!directoryLoaded?'Connecting to live supporters…':'No signatures recorded yet.');
  list.append(p);
 }
 const raw=$('count').textContent.replace(/,/g,'');
 const total=raw==='—'?null:Number(raw);
 $('supporterShown').textContent=directoryError
  ?directoryError
  :directoryRows.length.toLocaleString('en-IN')+' of '+(total===null?'—':total.toLocaleString('en-IN'))+' signatures displayed · LIVE';
 const hasMore=total===null?!directoryDone:directoryRows.length<total;
 $('moreSupporters').hidden=popupPageDocs===null||directoryBusy||directoryDone||!hasMore||!directoryRows.length;
 $('moreSupporters').disabled=directoryBusy;
}
// Only subscribe to the first 60 names when someone opens the full list.
// Main-page viewers listen to the newest TEN, keeping read costs bounded.
function startPopupListener(){
 if(stopPopupListener||!storeApi||!db)return;
 directoryRevision++;
 popupPageDocs=null;
 olderPageDocs=[];
 directoryCursor=null;
 directoryBusy=false;
 directoryDone=false;
 directoryError='';
 const query=storeApi.query(storeApi.collection(db,'lights'),
  storeApi.orderBy('createdAt','desc'),storeApi.limit(60));
 stopPopupListener=storeApi.onSnapshot(query,snapshot=>{
  const previousPage=popupPageDocs||[];
  const nextPage=snapshot.docs.map(doc=>({
   id:doc.id,createdAt:doc.data().createdAt,
   name:typeof doc.data().displayName==='string'&&doc.data().displayName.trim()?doc.data().displayName.trim():null,
   snapshot:doc
  }));
  // Preserve entries pushed off the first page by incoming signatures.
  // Otherwise a viewer paging during heavy activity could miss names.
  const nextIds=new Set(nextPage.map(row=>row.id));
  const evicted=previousPage.filter(row=>!nextIds.has(row.id));
  if(evicted.length){
   const previous=new Map(olderPageDocs.map(row=>[row.id,row]));
   evicted.forEach(row=>previous.set(row.id,row));
   olderPageDocs=Array.from(previous.values()).sort((a,b)=>
    (b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));
  }
  popupPageDocs=nextPage;
  // A previously complete first page can become full as signers arrive.
  if(popupPageDocs.length<60)directoryDone=true;
  else if(!directoryCursor)directoryDone=false;
  rebuildDirectory();
 },error=>{
  console.warn('Full supporter list listener failed',error);
  directoryError='Full supporter list unavailable. Please try again.';
  rebuildDirectory();
 });
 rebuildDirectory();
}
function closePopupListener(){
 if(stopPopupListener){stopPopupListener();stopPopupListener=null;}
 directoryRevision++;
 popupPageDocs=null;
 olderPageDocs=[];
 directoryCursor=null;
 directoryBusy=false;
 directoryDone=false;
 directoryError='';
 rebuildDirectory();
}
async function loadSupporterPage(){
 if(!storeApi||!db||directoryBusy||directoryDone||popupPageDocs===null)return;
 directoryBusy=true;directoryError='';renderSupporters();
 const revision=directoryRevision;
 try{
  // Cursor is derived from the last loaded historic page, or the live page.
  const cursor=directoryCursor || olderPageDocs.at(-1)?.snapshot || popupPageDocs.at(-1)?.snapshot;
  if(!cursor){directoryDone=true;return;}
  const q=storeApi.query(storeApi.collection(db,'lights'),
    storeApi.orderBy('createdAt','desc'),storeApi.startAfter(cursor),storeApi.limit(60));
  const snap=await storeApi.getDocsFromServer(q);
  if(revision!==directoryRevision)return;
  const rows=snap.docs.map(doc=>({
   id:doc.id,createdAt:doc.data().createdAt,
   name:typeof doc.data().displayName==='string'&&doc.data().displayName.trim()?doc.data().displayName.trim():null,
   snapshot:doc
  }));
  olderPageDocs.push(...rows);
  directoryCursor=snap.docs.at(-1)||directoryCursor;
  directoryDone=snap.docs.length<60;
  rebuildDirectory();
 }catch(error){
  console.error('Supporter pagination failed',error);
  directoryError='Older supporters could not be loaded. Please try again.';
 }finally{directoryBusy=false;renderSupporters();}
}
// Legacy count is a permanent baseline. New Cloud Function writes use 64
// distributed counter documents, with no hot shared document on signup.
function updateLegacyCount(value){
 legacyLoaded=true;legacyCount=Number.isFinite(value)?value:null;
 publishAggregateCount();
}
function updateShardCount(value){
 shardsLoaded=true;shardsCount=Number.isFinite(value)?value:null;
 publishAggregateCount();
}
function publishAggregateCount(){
 if(!legacyLoaded||!shardsLoaded)return;
 const aggregate=legacyCount===null||shardsCount===null?NaN:legacyCount+shardsCount;
 updateCount(aggregate);
}
function updateCount(value){
 serverCount=Number.isFinite(value)?value:null;
 // A confirmed callable may be acknowledged before both live listeners
 // advance. Retain the visible lower bound until the true total catches up.
 if(pendingCountFloor!==null&&serverCount!==null&&serverCount>=pendingCountFloor)
  pendingCountFloor=null;
 renderConfirmedCount();
}
function renderConfirmedCount(){
 const n=serverCount===null?pendingCountFloor:
   pendingCountFloor===null?serverCount:Math.max(serverCount,pendingCountFloor);
 const shown=n===null?'—':n.toLocaleString('en-IN');
 $('count').textContent=shown;
 $('countMirror').textContent=shown;
 $('supporterTotal').textContent=shown;
 // Counter updates are frequent. Don't rebuild every name row each time.
 const total=n;
 $('supporterShown').textContent=directoryRows.length.toLocaleString('en-IN')+
  ' of '+(total===null?'—':total.toLocaleString('en-IN'))+' signatures displayed · LIVE';
}
function showConnected(text){const status=document.getElementById('connectionStatus');if(status)status.textContent=text;}
function markSigned(animate=true,publicName=''){
 // The server confirmed the signature (or that this account already signed).
 // Display that person immediately while the public Firestore listener catches up.
 pendingOwnId=auth?.currentUser?.uid||null;
 pendingOwnName=typeof publicName==='string'?publicName.trim():'';
 drawPeople(recentSupporterIds);
 signed=true;sessionStorage.setItem('oneVoiceSigned','true');
 if(animate && pendingOwnId)window.OneVoiceRoad?.celebrate(pendingOwnId,pendingOwnName);
 $('openSign').innerHTML='VOICE ADDED <span>✓</span>';
 setDialog($('modal'),false);
 window.scrollTo({top:0,behavior:'instant'});
 if(animate){setTimeout(()=>{if(signed && $('modal').hidden && $('petitionModal').hidden && $('supportersModal').hidden)setDialog($('success'),true);},1900);}else setDialog($('success'),true);
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
 if(!$('signName').value.trim()){message('Please enter your full name.');$('signName').focus();return;}
 if(!points.length){message('Please draw your signature first.');return;}
 if(!$('agree').checked){message('Please accept the consent checkbox.');return;}
 if(!$('showName').checked){message('To sign, please agree to display your name on the public supporters list.');return;}
 // Capture the last verified counter before the callable round trip.
 const countBeforeSubmission=serverCount;
 submitting=true;updateForm();$('submitSign').innerHTML='SAVING YOUR VOICE…';
 message('Submitting securely. Do not close the page.');
 try{
  // Reading the campaign never creates a Firebase Auth account. Only an
  // actual submitted signature needs an anonymous authenticated UID.
  await auth.authStateReady();
  if(!auth.currentUser)await signInAnonymously(auth);
  const addVoice=httpsCallable(functions,'addVoice');
  const strokes=points.map(line=>line.map(([x,y])=>[Math.round(x*1000)/1000,Math.round(y*1000)/1000]));
  const result=await addVoice({name:$('signName').value.trim(),strokes,consent:true,showName:$('showName').checked});
  if($('showName').checked && result?.data?.publicNameListed!==true){
   $('success').querySelector('.success-toast-copy span').textContent='Signature saved. Public name listing needs the updated Cloud Function.';
  }
  // The callable has committed all three server writes. Update the local
  // count and both name lists in the same turn, without waiting for either
  // independent Firestore listener or inventing an unconfirmed signature.
  const uid=auth?.currentUser?.uid||null;
  const publicName=result?.data?.publicNameListed===true?$('signName').value.trim():'';
  if(uid){
   // The names and counter travel on independent listeners. Advance the
   // displayed total at acknowledgment even if the name arrived first.
   // Never add another +1 if the server already reported this increment.
   if(countBeforeSubmission!==null)
    pendingCountFloor=Math.max(pendingCountFloor??0,countBeforeSubmission+1);
   if(!latestPageDocs.some(row=>row.id===uid)){
    confirmedLocal={
     id:uid,name:publicName||null,
     createdAt:{toMillis:()=>Date.now()},snapshot:null
    };
    // Under a surge a new signature can leave the top-ten live window
    // before its confirmation arrives. Don't pin it at the top forever.
    setTimeout(()=>{
     if(confirmedLocal?.id===uid){confirmedLocal=null;rebuildDirectory();}
    },12000);
   }
   directoryLoaded=true;
   rebuildDirectory();
   renderConfirmedCount();
  }
  markSigned(true,publicName);
 }catch(error){
  console.error('Signature submission failed:',error);
  if(error.code==='functions/already-exists'){
   markSigned(false);
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
  organizerAuthApi=authM;
  authM.onAuthStateChanged(auth,()=>{refreshOrganizerStatus();});
  db=storeM.getFirestore(app);
  storeApi=storeM;
  functions=functionsM.getFunctions(app,'asia-south1');
  httpsCallable=functionsM.httpsCallable;
  signInAnonymously=authM.signInAnonymously;
  // Public campaign listeners should remain live even if anonymous sign-in fails.
  // Existing signatures stay in the legacy document; new ones are spread
  // across 64 shards. Display their sum without losing historic totals.
  storeM.onSnapshot(storeM.doc(db,'stats','campaign'),snapshot=>{
   updateLegacyCount(snapshot.exists()?Number(snapshot.data().count)||0:0);
  },error=>{
   console.warn('Legacy counter subscription failed',error);
   updateLegacyCount(NaN);
  });
  storeM.onSnapshot(storeM.collection(db,'counterShards'),snapshot=>{
   const sum=snapshot.docs.reduce((acc,doc)=>acc+(Number(doc.data().count)||0),0);
   updateShardCount(sum);
  },error=>{
   console.warn('Distributed counter subscription failed',error);
   updateShardCount(NaN);
  });
  const lightsRef=storeM.collection(db,'lights');
  const recentQuery=storeM.query(lightsRef,storeM.orderBy('createdAt','desc'),storeM.limit(10));
  storeM.onSnapshot(recentQuery,snapshot=>{
    const ids=snapshot.docs.map(doc=>doc.id);
    liveRecentIds.clear();
    ids.forEach(id=>liveRecentIds.add(id));
    publicNamesById=new Map(snapshot.docs.map(doc=>
     [doc.id,typeof doc.data().displayName==='string'?doc.data().displayName.trim():''])
     .filter(([,name])=>!!name));
    latestPageDocs=snapshot.docs.map(doc=>({
     id:doc.id,createdAt:doc.data().createdAt,
     name:typeof doc.data().displayName==='string'&&doc.data().displayName.trim()?doc.data().displayName.trim():null,
     snapshot:doc
    }));
    directoryLoaded=true;directoryError='';
    if(confirmedLocal&&latestPageDocs.some(row=>row.id===confirmedLocal.id))
     confirmedLocal=null;
    if(pendingOwnId&&ids.includes(pendingOwnId)){
     pendingOwnId=null;pendingOwnName='';
    }
    drawPeople(ids);
    rebuildDirectory();
  },error=>{
    console.warn('Live supporter list subscription failed',error);
    directoryError='Live supporter list unavailable. Please refresh.';
    const notice=$('voicesNotice');
    if(notice)notice.textContent='Live illustrations unavailable. Please refresh.';
    renderSupporters();
    renderLatestSupporters();
  });
  // The public view uses read-only collections and needs no sign-in.
  ready=true;updateForm();
  if(!$('supportersModal').hidden)startPopupListener();
 }catch(error){
  console.error('Firebase setup failed:',error);
  ready=false;updateForm();
  message('Unable to connect to the campaign. Ask an organizer to check Firebase Authentication.');
 }
}

/* A separate Google sign-in is used for organizer exports. The Cloud Function
 * checks the custom organizer claim; hiding the button alone is not security.
 */
let organizerBusy=false,organizerAuthenticated=false;
let organizerAuthApi=null;
const exportNote=(text)=>{$('exportStatus').textContent=text;};
function updateOrganizerButtons(){
 $('exportActions').hidden=!organizerAuthenticated;
 $('organizerLogin').textContent=organizerAuthenticated?'ORGANIZER SIGNED IN ✓':'ORGANIZER SIGN IN ↗';
 $('organizerLogin').disabled=organizerBusy||organizerAuthenticated;
 for(const id of ['exportPDF','exportCSV'])$(id).disabled=organizerBusy||!organizerAuthenticated;
}
async function refreshOrganizerStatus(){
 if(!auth?.currentUser){organizerAuthenticated=false;updateOrganizerButtons();return;}
 try{
  const token=await auth.currentUser.getIdTokenResult(true);
  organizerAuthenticated=token.claims.oneVoiceOrganizer===true;
 }catch(error){organizerAuthenticated=false;console.warn('Organizer claim lookup failed',error);}
 updateOrganizerButtons();
}
$('organizerLogin').onclick=async()=>{
 if(organizerBusy)return;
 if(!organizerAuthApi||!auth){exportNote('Firebase is not connected yet. Please refresh.');return;}
 organizerBusy=true;updateOrganizerButtons();exportNote('Sign in with the Google account approved by the campaign organizer.');
 try{
  const provider=new organizerAuthApi.GoogleAuthProvider();
  await organizerAuthApi.signInWithPopup(auth,provider);
  await refreshOrganizerStatus();
  exportNote(organizerAuthenticated?'Organizer verified. You can export the report.':'This Google account is not authorized for organizer exports. Ask the project owner to grant the organizer claim.');
 }catch(error){
  console.warn('Organizer sign in failed',error);
  exportNote(error.code==='auth/popup-blocked'?'Popup blocked. Allow popups and try again.':(error.message||'Sign-in failed. Please retry.'));
 }finally{organizerBusy=false;updateOrganizerButtons();}
};
async function getExportRows(includeSignatures=false){
 if(!organizerAuthenticated||!auth?.currentUser)throw Error('Organizer authorization required.');
 const fn=httpsCallable(functions,'exportSupportersPage');
 const all=[];let cursor=null;
 do{
  exportNote('Collecting '+(includeSignatures?'names and signatures':'names')+'… '+all.length.toLocaleString('en-IN')+' records loaded');
  const response=await fn({cursor,includeSignatures});
  const data=response.data||{};
  if(!Array.isArray(data.rows))throw Error('Invalid export response.');
  for(const row of data.rows){
   all.push({
    name:typeof row.name==='string'?row.name:'', 
    signedAt:typeof row.signedAt==='string'?row.signedAt:'',
    strokes:includeSignatures&&Array.isArray(row.strokes)?row.strokes:[]
   });
  }
  cursor=data.nextCursor||null;
  if(all.length>250000)throw Error('Export limit reached. Contact the organizer.');
 }while(cursor);
 return all;
}
function safeCsv(value){
 let text=String(value??'');
 if(/^[\s]*[=+@-]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
function exportCsv(rows){
 const lines=[['No.','Name','Signed At (UTC)'],...rows.map((r,i)=>[i+1,r.name||'Name not recorded',r.signedAt])];
 const blob=new Blob(['\uFEFF'+lines.map(a=>a.map(safeCsv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 saveBlob(blob,'one-voice-supporters.csv');
}
function saveBlob(blob,name){
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';
 document.body.append(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},1200);
}
// Browser-native PDF export: no jsPDF CDN, preserves Malayalam/Unicode text.
function exportPdf(rows){
 let report=document.getElementById('exportPrintReport');
 if(!report){
  report=document.createElement('section');
  report.id='exportPrintReport';
  report.setAttribute('aria-label','ONE VOICE confidential supporter report with digital signatures');
  document.body.append(report);
 }
 report.replaceChildren();
 const title=document.createElement('h1');title.textContent='ONE VOICE';
 const subtitle=document.createElement('p');
 subtitle.className='report-subtitle';
 subtitle.textContent='INFOPARK | SIGNATURE CAMPAIGN';
 const privateLabel=document.createElement('h2');
 privateLabel.textContent='CONFIDENTIAL — ORGANIZER COPY';
 const summary=document.createElement('p');
 summary.className='report-summary';
 summary.textContent='Saved signature records: '+rows.length.toLocaleString('en-IN')+' | Exported: '+new Date().toLocaleString('en-IN');
 const table=document.createElement('table');
 const thead=document.createElement('thead'),heading=document.createElement('tr');
 for(const text of ['NO.','SUPPORTER NAME','HANDWRITTEN SIGNATURE','SIGNED AT (UTC)']){
  const th=document.createElement('th');th.textContent=text;heading.append(th);
 }
 thead.append(heading);table.append(thead);
 const tbody=document.createElement('tbody');
 for(let i=0;i<rows.length;i++){
  const tr=document.createElement('tr');
  const n=document.createElement('td');n.textContent=String(i+1);
  const name=document.createElement('td');name.textContent=rows[i].name||'Name not recorded';
  const signature=document.createElement('td');signature.className='report-signature';
  const strokes=rows[i].strokes;
  if(Array.isArray(strokes)&&strokes.some(line=>Array.isArray(line)&&line.length)){
   const ns='http://www.w3.org/2000/svg';
   const svg=document.createElementNS(ns,'svg');
   svg.setAttribute('viewBox','0 0 1000 1000');
   svg.setAttribute('preserveAspectRatio','none');
   svg.setAttribute('role','img');
   svg.setAttribute('aria-label','Digitally drawn signature');
   for(const line of strokes){
    if(!Array.isArray(line)||!line.length)continue;
    const valid=line.filter(pt=>Array.isArray(pt)&&pt.length===2&&pt.every(v=>typeof v==='number'&&v>=0&&v<=1));
    if(!valid.length)continue;
    const path=document.createElementNS(ns,'path');
    const d=valid.map((pt,j)=>(j?'L':'M')+(pt[0]*1000).toFixed(1)+' '+(pt[1]*1000).toFixed(1)).join(' ');
    path.setAttribute('d',valid.length===1?d+' l .5 .5':d);
    path.setAttribute('fill','none');path.setAttribute('stroke','#121212');
    path.setAttribute('stroke-width','12');path.setAttribute('stroke-linecap','round');
    path.setAttribute('stroke-linejoin','round');svg.append(path);
   }
   signature.append(svg);
  }else signature.textContent='Not available';
  const date=document.createElement('td');date.textContent=(rows[i].signedAt||'').replace('T',' ').slice(0,19);
  tr.append(n,name,signature,date);tbody.append(tr);
 }
 table.append(tbody);report.append(title,subtitle,privateLabel,summary,table);
 exportNote('Loaded '+rows.length.toLocaleString('en-IN')+' names and signatures. In the print dialog, choose Save as PDF. If no dialog opens, tap DOWNLOAD PDF again.');
 // Allow a layout frame before printing the report. No external scripts needed.
 return new Promise(resolve=>{
  requestAnimationFrame(()=>setTimeout(()=>{
   try{window.print();}finally{resolve();}
  },100));
 });
}
async function startExport(type){
 if(organizerBusy)return;
 organizerBusy=true;updateOrganizerButtons();
 try{
  const rows=await getExportRows(type==='pdf');
  if(type==='pdf')await exportPdf(rows);else exportCsv(rows);
  exportNote((type==='pdf'?'Report prepared for '+rows.length.toLocaleString('en-IN')+' records. Choose Save as PDF in the print dialog.':'Exported '+rows.length.toLocaleString('en-IN')+' saved records.')+' Keep the file confidential.');
 }catch(error){
  console.error('Organizer export failed',error);
  exportNote(error.code==='functions/permission-denied'?'Organizer permission denied. Ask the project owner to authorize your Google account.':error.message||'Export failed. Please try again.');
 }finally{organizerBusy=false;updateOrganizerButtons();}
}
$('exportPDF').onclick=()=>startExport('pdf');
$('exportCSV').onclick=()=>startExport('csv');

init();
