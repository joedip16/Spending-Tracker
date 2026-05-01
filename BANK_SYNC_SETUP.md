# Bank Sync Setup

This app now includes a first-pass Plaid + Firebase Functions bank-sync scaffold.

What it does:
- Lets a signed-in user connect a bank or credit-card institution with Plaid Link.
- Stores safe linked-account metadata in Firestore under `users/{uid}/bankConnections`.
- Stores the Plaid access token server-side only in `plaidPrivateItems`.
- Pulls linked-account transactions and opens the app's existing import preview so the user can review duplicates and categories before import.

What you still need to do:

1. Install Cloud Functions dependencies
   - `cd functions`
   - `npm install`

2. Set Plaid environment variables for Functions
   - `PLAID_CLIENT_ID`
   - `PLAID_SECRET`
   - `PLAID_ENV`

3. Turn the feature on in the client
   - In [firebase-config.js](/Users/joedippolito/Coding/50:30:20%20Tracker/firebase-config.js:1), set `window.bankSyncEnabled = true;`

4. Deploy Firestore rules and Functions
   - `./firebase_tools deploy --only firestore:rules`
   - `./firebase_tools deploy --only functions`

5. Test with Plaid Sandbox first
   - Plaid Quickstart docs: https://plaid.com/docs/quickstart/
   - Link Web docs: https://plaid.com/docs/link/web/
   - Transactions docs: https://plaid.com/docs/transactions/

Important notes:
- Plaid transaction amounts are positive for money flowing out and negative for money flowing in. The app converts those values into its own format before import preview.
- This first version does not auto-delete previously imported app transactions when a bank transaction later disappears or changes status. It is designed as a review-before-import flow, not a fully automatic ledger reconciliation engine yet.
- OAuth-heavy institutions may need additional Plaid redirect configuration later.
