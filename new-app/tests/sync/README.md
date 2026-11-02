# Sync regression tests

Run from `new-app/` with Firebase CLI installed:

```sh
npm run test:sync:build
firebase emulators:exec --project demo-antruong-v2 --only firestore,auth "node tests/sync/live.mjs && node tests/sync/backups.mjs"
```

The build replaces the production Firebase module with emulator-only clients. Tests cover two-client updates without full reloads, owner history failures, permission revocation, listener reuse, and daily pre-edit backups. Reported timing is emulator-only, not a production latency target.
