# ONE VOICE — Infopark

A digital road-safety solidarity campaign. Visitors can draw a signature, light an anonymous warning light, and see the live count.

## Setup

1. In Firebase project `one-voice-44e1f`, enable **Authentication > Anonymous** and create **Cloud Firestore**.
2. Install Firebase CLI (`npm install -g firebase-tools`) and log in (`firebase login`).
3. Install functions dependencies (`cd functions && npm install && cd ..`).
4. Deploy using `firebase deploy --project one-voice-44e1f --only firestore:rules,functions,hosting`.

Functions deployment may require the Firebase Blaze plan. The site is not live until deployment succeeds.

## Security

Signatures are private in Firestore. Public lights contain no names or drawn strokes. The count measures submissions, not uniquely verified persons; anonymous accounts can be recreated. Prior to a large public launch, implement App Check and rate limiting, provide a privacy/retention notice, and test on mobile.
