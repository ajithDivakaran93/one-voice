// One-time organizer authorization. Run with ADC credentials, never on web hosting.
// Usage: node scripts/grant-organizer.cjs you@example.com
const admin=require('../functions/node_modules/firebase-admin');
const email=process.argv[2];
if(!email||!email.includes('@')){console.error('Usage: node scripts/grant-organizer.cjs email@example.com');process.exit(1);}
admin.initializeApp({projectId:'one-voice-44e1f'});
(async()=>{
 const auth=admin.auth();
 const user=await auth.getUserByEmail(email);
 // Preserve unrelated custom claims.
 await auth.setCustomUserClaims(user.uid,{...(user.customClaims||{}),oneVoiceOrganizer:true});
 console.log('Organizer access granted for:',user.email);
 console.log('Sign out and sign back in to refresh your access.');
})().catch(e=>{console.error('Unable to grant organizer access:',e.message);process.exit(1);});
