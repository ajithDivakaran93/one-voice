const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');
const {shardForUid}=require('./counter-shards');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
initializeApp(); const db=getFirestore();
// Multiple independently writable counter documents eliminate contention on
// the legacy stats/campaign document as the campaign grows.
exports.addVoice=onCall({region:'asia-south1',maxInstances:30},async request=>{
 if(!request.auth?.uid)throw new HttpsError('unauthenticated','Please reload and try again.');
 const {name='',strokes,consent,showName=false}=request.data||{};
 if(showName!==true)throw new HttpsError('invalid-argument','Public name display consent is required for new signatures.');
 if(consent!==true)throw new HttpsError('invalid-argument','Consent required.');
 if(typeof name!=='string'||!name.trim()||name.trim().length>60)throw new HttpsError('invalid-argument','Full name is required (up to 60 characters).');
 if(!Array.isArray(strokes)||strokes.length<1||strokes.length>40)throw new HttpsError('invalid-argument','Please draw your signature.');
 let total=0;
 for(const line of strokes){if(!Array.isArray(line)||line.length<1||line.length>400)throw new HttpsError('invalid-argument','Invalid stroke.');for(const pt of line){total++;if(!Array.isArray(pt)||pt.length!==2||pt.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))throw new HttpsError('invalid-argument','Invalid signature coordinate.');}}
 if(total>400)throw new HttpsError('invalid-argument','Signature too large.');
 const uid=request.auth.uid;
 const signature=db.collection('signatures').doc(uid),light=db.collection('lights').doc(uid);
 const shard=db.collection('counterShards').doc(String(shardForUid(uid)).padStart(2,'0'));
 await db.runTransaction(async t=>{
  if((await t.get(signature)).exists)throw new HttpsError('already-exists','This account already signed.');
  t.create(signature,{name:name.trim(),strokes,consent:true,showName:true,consentVersion:'2026-11-v3',createdAt:FieldValue.serverTimestamp()});
  t.create(light,{createdAt:FieldValue.serverTimestamp(),...(showName?{displayName:name.trim()}: {})});
  // Legacy signatures remain counted in stats/campaign. All new signatures
  // contribute exactly once to a counter shard within this same transaction.
  t.set(shard,{count:FieldValue.increment(1)},{merge:true});
 });
 return {ok:true,publicNameListed:showName};
});
exports.publishSupporterName=onCall({region:'asia-south1',maxInstances:20},async request=>{
 if(!request.auth?.uid)throw new HttpsError('unauthenticated','Sign in again using the browser you signed from.');
 const {name,consent}=request.data||{};
 if(consent!==true)throw new HttpsError('invalid-argument','Public name display requires explicit consent.');
 if(typeof name!=='string'||!name.trim()||name.trim().length>60)
  throw new HttpsError('invalid-argument','Enter a name (up to 60 characters).');
 const uid=request.auth.uid;
 const signature=db.collection('signatures').doc(uid),light=db.collection('lights').doc(uid);
 await db.runTransaction(async t=>{
  const [sigSnap,lightSnap]=await Promise.all([t.get(signature),t.get(light)]);
  if(!sigSnap.exists||!lightSnap.exists)
   throw new HttpsError('failed-precondition','No signature found for this browser. Only existing signers can publish a name.');
  t.update(signature,{showName:true,publicDisplayName:name.trim(),publicNameConsentAt:FieldValue.serverTimestamp()});
  t.update(light,{displayName:name.trim()});
 });
 return {ok:true};
});


/**
 * Organizer-only read of saved names. Requires a Firebase Auth custom claim
 * "oneVoiceOrganizer: true"; never returns handwritten strokes, email or UID.
 * Client pages in deterministic document-id order so reports can exceed 10k.
 */
exports.exportSupportersPage=onCall({region:'asia-south1',maxInstances:10},async request=>{
 if(!request.auth?.uid||request.auth.token.oneVoiceOrganizer!==true)
  throw new HttpsError('permission-denied','Organizer access required.');
 const cursor=request.data?.cursor;
 if(cursor!==null&&cursor!==undefined&&
    (typeof cursor!=='string'||cursor.length>180))
  throw new HttpsError('invalid-argument','Invalid export cursor.');
 const {FieldPath}=require('firebase-admin/firestore');
 let q=db.collection('signatures').orderBy(FieldPath.documentId()).limit(300);
 if(cursor)q=q.startAfter(cursor);
 const page=await q.get();
 const rows=page.docs.map(doc=>{
  const data=doc.data();
  const rawName=typeof data.name==='string'?data.name:
    (typeof data.publicDisplayName==='string'?data.publicDisplayName:'');
  const name=rawName.trim().slice(0,60);
  const signedAt=data.createdAt?.toDate?.()?.toISOString?.()||'';
  return {name,signedAt};
 });
 return {
  rows,
  nextCursor:page.size===300?page.docs[page.docs.length-1].id:null,
  pageSize:page.size
 };
});
