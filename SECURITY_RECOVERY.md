# Security and Disaster-Recovery Plan

## Firebase App Check

App Check support is built into the app but disabled until a site key is configured.

1. In Firebase Console, open App Check.
2. Register the web app for App Check using reCAPTCHA v3 or reCAPTCHA Enterprise.
3. Copy the public site key into `firebase-config.js`.
4. Set `window.firebaseAppCheckEnabled = true`.
5. Deploy Hosting.
6. Monitor App Check metrics before enabling enforcement for Authentication or Firestore.

Do not commit App Check debug tokens. If local testing needs a debug token, set it only in your local `firebase-config.js` and remove it before release.

## Firestore Access Model

User data lives under:

- `users/{uid}/budgetTracker/appState`
- `users/{uid}/cloudBackups/{backupId}`

Rules require the signed-in user's UID to match `{uid}`. App state writes must match the expected top-level shape, and cloud backup documents are create-only to protect restore points from accidental overwrite.

## Backup Strategy

Users have three recovery options:

- Local CSV/JSON export from Settings.
- Cloud restore points created from Account Sync.
- Automatic safety restore point before restoring the latest cloud backup.

Before major schema changes, export a JSON backup from a test account and create a cloud restore point.

## Incident Playbook

If a bad deploy breaks the app:

1. Roll back Firebase Hosting to the previous release in Firebase Console > Hosting.
2. Do not change Firestore rules again until the app loads and sync is verified.
3. Use a test account to confirm sign-in, sync, backup creation, and backup restore.
4. If user data was corrupted, restore from the user's latest cloud backup or their exported JSON backup.

If Firestore rules block legitimate users:

1. Check the browser console for Firestore permission errors.
2. Confirm the deployed app writes the expected `appState` shape.
3. Temporarily deploy the last known-good rules if needed.
4. Re-test writes with a non-admin account before re-enabling stricter rules.

## Release Checklist

- Run `node --check script.js`.
- Deploy Firestore rules.
- Deploy Hosting.
- Verify login, sync, cloud backup, cloud restore, import, and account deletion with a test account.
- Confirm Privacy Policy and Terms are reachable from Settings.
