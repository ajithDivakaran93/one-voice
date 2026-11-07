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

## Firebase Hosting URLs

Both sites are part of the **same Firebase project** and use the same Firestore and Cloud Functions. Hosting deploy targets are mapped in `.firebaserc`:

- `main` -> `one-voice-44e1f.web.app` (existing site)
- `justice` -> `onevoiceforjustice-pt.web.app` (additional site)

After pulling the repository, deploy only the new website without changing any database or backend resources:

```sh
firebase deploy --project one-voice-44e1f --only hosting:justice
```

To deploy only the original site, use `--only hosting:main`. A general `--only hosting` deployment will deploy **both** sites. The exact name `onevoiceforjustice.web.app` is **not** created by the `onevoiceforjustice-pt` site ID. If the shorter ID is available, it requires creating a separate Firebase Hosting site.

Before publicizing the new address, verify that anonymous sign-in, Cloud Functions, latest names and signature count work end-to-end. If Firebase Authentication reports an unauthorized-domain error, check **Authentication > Settings > Authorized domains** and add `onevoiceforjustice-pt.web.app`. Keep the original address online until the new one is verified.

## High-volume signature architecture (10,000+ cumulative signatures)

- Each successful `addVoice` call verifies an authenticated Firebase UID, validates a mandatory public name and drawn signature, and atomically creates one private `signatures/{uid}` record, one public `lights/{uid}` record, and increments exactly **one of 64** counter documents in `counterShards/{00..63}`.
- The transaction checks `signatures/{uid}` for duplicates. Failed or retried submissions do not increment the counter again for the same UID.
- **Historical count preservation:** Old signatures remain counted in `stats/campaign.count`, which becomes the **legacy baseline**. New signatures are counted only through the 64 shard documents. The displayed counter equals **legacy baseline + sum of shards**. Do not delete or reset `stats/campaign.count` during rollout.
- Public visitors **do not create anonymous Firebase Auth accounts**. The browser authenticates only when someone submits a signature, reducing Authentication traffic and unused accounts during public surges.
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


## Export all saved supporter names (organizers only)

The **View Supporters** popup now includes **Organizer Sign In**, **Download PDF** and
**Download CSV**. The exports use `exportSupportersPage`, a privileged Cloud Function
that reads the private `signatures` collection in batches of 300. It excludes
signature drawings, user IDs, and authentication identifiers. This is a confidential
organizer report; do not publish names without the signers' permission.

Setup (one time):

1. Firebase Console > Authentication > Sign-in method: enable **Google**.
   Also check the authorized domain for the deployed website under Authentication > Settings.
2. Deploy the updated Cloud Function and hosting:
   `firebase deploy --project one-voice-44e1f --only functions,hosting`
3. Open the website's View Supporters popup and click **Organizer Sign In**,
   then sign in with the organizer's Google account. It will initially say unauthorized.
4. On a trusted computer with Google Cloud Application Default Credentials authorized
   to manage Firebase Auth users (and after running `npm install` under `functions`), run:
   `node scripts/grant-organizer.cjs organizer@example.com`
   Replace the example email. Sign out and back in to refresh the token.

A privileged project administrator can prepare Application Default Credentials by
running `gcloud auth application-default login`. Never place a service account
private key or access token into the public repository or website JavaScript.

The PDF uses a browser-downloaded jsPDF library and includes Unicode names rendered
using browser fonts (including Malayalam, where installed). Large reports may require
time and memory on mobile; CSV is the most portable backup.

**Important:** Earlier signers did not necessarily consent to public name display.
The organizer-only report can include their private stored names solely for
authorized internal purposes; the public supporters list remains consent-filtered.
