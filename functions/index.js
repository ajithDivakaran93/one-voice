const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
initializeApp(); const db=getFirestore();
exports.addVoice=onCall({region:'asia-south1',maxInstances:30},async request=>{
 if(!request.auth?.uid)throw new HttpsError('unauthenticated','Please reload and try again.');
 const {name='',strokes,consent}=request.data||{};
 if(consent!==true)throw new HttpsError('invalid-argument','Consent required.');
 if(typeof name!=='string'||name.trim().length>60)throw new HttpsError('invalid-argument','Invalid name.');
 if(!Array.isArray(strokes)||strokes.length<1||strokes.length>40)throw new HttpsError('invalid-argument','Please draw your signature.');
 let total=0;
 for(const line of strokes){if(!Array.isArray(line)||line.length<1||line.length>400)throw new HttpsError('invalid-argument','Invalid stroke.');for(const pt of line){total++;if(!Array.isArray(pt)||pt.length!==2||pt.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))throw new HttpsError('invalid-argument','Invalid signature coordinate.');}}
 if(total>400)throw new HttpsError('invalid-argument','Signature too large.');
 const uid=request.auth.uid;
 const signature=db.collection('signatures').doc(uid),light=db.collection('lights').doc(uid),stats=db.collection('stats').doc('campaign');
 await db.runTransaction(async t=>{
  if((await t.get(signature)).exists)throw new HttpsError('already-exists','This account already signed.');
  t.create(signature,{name:name.trim(),strokes,consent:true,consentVersion:'2026-11-v1',createdAt:FieldValue.serverTimestamp()});
  t.create(light,{createdAt:FieldValue.serverTimestamp()});
  t.set(stats,{count:FieldValue.increment(1),updatedAt:FieldValue.serverTimestamp()},{merge:true});
 });
 return {ok:true};
});