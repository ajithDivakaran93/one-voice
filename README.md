# ONE VOICE — Infopark

A Firebase-hosted road-safety petition with a private drawn-signature record, a public opt-in name directory, and an animated solidarity road.

## Deploying

1. Enable **Firebase Authentication > Anonymous** and create **Cloud Firestore** on project `one-voice-44e1f`.
2. Install the Firebase CLI and authenticate (`npm install -g firebase-tools && firebase login`).
3. Run `npm install --prefix functions`.
4. Deploy **Firestore rules, Cloud Functions, and hosting together**:

   ```sh
   firebase deploy --project one-voice-44e1f --only firestore:rules,functions,hosting
   ```

   **Do not deploy only hosting when introducing the distributed counter.** The new client needs permission to read `counterShards`; the new backend must write shards rather than the previous hot counter document. First deploy may require the Firebase Blaze plan. Code committed to GitHub is not automatically live.

## High-volume signature architecture (10,000+ cumulative signatures)

- Each successful `addVoice` call verifies an authenticated Firebase UID, validates a mandatory public name and drawn signature, and atomically creates one private `signatures/{uid}` record, one public `lights/{uid}` record, and increments exactly **one of 64** counter documents in `counterShards/{00..63}`.
- The transaction checks `signatures/{uid}` for duplicates. Failed or retried submissions do not increment the counter again for the same UID.
- **Historical count preservation:** Old signatures remain counted in `stats/campaign.count`, which becomes the **legacy baseline**. New signatures are counted only through the 64 shard documents. The displayed counter equals **legacy baseline + sum of shards**. Do not delete or reset `stats/campaign.count` during rollout.
- The public page subscribes to the most recent **10** `lights` records for the names and roadside figures. **View All Supporters** subscribes to **60** records only while its popup is open; the rest are loaded through Firestore cursors in bounded pages.
- The browser has an immediate server-acknowledged update for its own new signature. Other viewers receive live snapshots over Firestore; propagation latency depends on network and server load. Full signatures are never downloaded to the browser.

This eliminates the single-document write hotspot and removes the previous always-on 140 + 60 record subscriptions. **10,000 stored signatures is different from 10,000 people submitting simultaneously**. Peak throughput, concurrent read costs and availability must be validated with staging load tests and billing/quotas monitoring before a mass launch.

## Pre-launch requirements

- **Enable Firebase App Check** for Firestore and callable Functions with a configured web provider before enforcement. Doing so requires a client-side site key and Firebase Console settings; do not switch on enforcement until clients have valid tokens.
- Add abuse controls. Anonymous Firebase accounts prevent multiple signatures per UID but **do not verify unique people**; new browsers can obtain new UIDs. Consider rate limits, CAPTCHA and moderator review for a petition expecting heavy traffic.
- Monitor Cloud Functions 2nd-generation concurrency/errors, Firestore reads/writes, costs, document contention and Authentication Anonymous quota. Establish spending alerts and back up private signatures.
- Define signature privacy, retention, opt-in disclosure, deletion and moderation policies.
- Exercise real sign-up, count, privacy, newest-ten, full-directory pagination, and offline/error behavior in staging before launching.
- Run the included deterministic distribution test: `node --test functions/counter-shards.test.js`. This validates shard assignment for 10,000 *simulated IDs*; it is **not** a backend throughput/load test.

## Public/Private data

`signatures` is server-only. `lights` exposes only public opt-in names, creation time, and an anonymous auth document identifier. `stats/campaign` and `counterShards` are public read-only; all writes must go through Cloud Functions.
