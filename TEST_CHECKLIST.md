# 50:40:30 Budget Tracker Test Checklist

Use this checklist before public releases, store submissions, or major Firebase rule changes.

Tester:
Date:
Build / URL: https://budget-tracker-b0f66.web.app
Browser / Device:

Result key: Pass / Fail / Blocked / Not Tested

## 1. Account Creation and Login

- Result:
- Create a new test account from onboarding.
- Verify the app advances after account creation.
- Sign out from Settings > Account Sync.
- Sign back in with the same account.
- Verify incorrect password shows a useful error.
- Verify Settings shows the signed-in email.

Notes:

## 2. Sync Across Devices

- Result:
- Sign in on device A.
- Add a manual income transaction on device A.
- Sign in with the same account on device B.
- Verify the transaction appears on device B.
- Add an expense transaction on device B.
- Verify the transaction appears on device A after refresh or reconnect.
- Change budget goals on device A.
- Verify budget goals sync to device B.
- Change dark mode on one device.
- Verify dark mode syncs after refresh on the other device.

Notes:

## 3. Onboarding

- Result:
- Clear local browser data or use a private window.
- Verify first-run onboarding appears.
- Test skipping account creation.
- Test account creation from onboarding.
- Choose Single setup and finish.
- Repeat with Joint setup and confirm Single View / Joint View buttons behave correctly.
- Set custom goals and confirm Home targets update.
- Use the onboarding buttons to go to Import Transactions and Add One Manually.
- Confirm positive income and negative spending explanation is visible.

Notes:

## 4. Manual Transactions

- Result:
- Add positive income: `3000`.
- Add negative Needs expense: `-120.50`.
- Add negative Wants expense: `-18.75`.
- Use calculator amount input: `12.50+8.25`, confirm it saves as `20.75`.
- Use calculator sign toggle.
- Add Single purchase.
- Add Joint purchase.
- Edit a transaction.
- Delete a transaction.
- Verify dashboard updates after each change.

Notes:

## 5. Imports

- Result:
- Import a simple CSV with `Date`, `Description`, `Amount`.
- Import a CSV with extra rows before the real header.
- Import a bank format with `Transaction Date`, `Merchant`, `Amount`.
- Import a bank format with separate `Debit` and `Credit` columns.
- Verify debit rows become negative expenses.
- Verify credit rows become positive income.
- Change column mappings in preview and refresh.
- Re-import the same header format and verify mappings are remembered.
- Confirm category and Single/Joint choices can be changed in preview.
- Confirm importing one file does not overwrite previous imports.

Notes:

## 6. Duplicate Transactions

- Result:
- Import a file with a transaction that already exists.
- Verify duplicates are highlighted and unchecked by default.
- Click Include Duplicates and verify duplicate rows are selected.
- Click Skip Duplicates and verify duplicate rows are unselected.
- Import selected duplicates and choose to double them.
- Import selected duplicates and choose to overwrite.
- Manually add an identical transaction.
- Verify duplicate prompt appears.
- Test both double and overwrite choices.

Notes:

## 7. Recurring Transactions

- Result:
- Add a recurring monthly Needs transaction.
- Add a recurring weekly Wants transaction.
- Add a recurring yearly Income transaction.
- Use Add Transaction and check Make Recurring.
- Verify the selected frequency is saved.
- Click Apply Recurring Now.
- Verify generated transactions appear in the right month/year.
- Delete one generated recurring transaction.
- Verify skipped occurrence does not reappear after applying recurring again.

Notes:

## 8. Budget Goals and Category Manager

- Result:
- Change top-level goals to 50/30/20.
- Change goals to custom values that still total 100.
- Try invalid goals below 0 or above 100.
- Set an individual category monthly goal.
- Verify category manager sections are collapsed by default.
- Verify category monthly goal appears in breakdown.
- Verify budget goal bars do not cut off text on mobile.

Notes:

## 9. Backups and Restore

- Result:
- Export JSON backup.
- Export CSV backup.
- Create Cloud Backup from Settings > Account Sync.
- Restore Latest Cloud Backup.
- Verify a safety backup is created before restore.
- Import JSON backup into a clean browser.
- Import CSV backup into a clean browser.
- Verify profile, goals, categories, recurring rules, and transactions restore.

Notes:

## 10. Privacy and Account Controls

- Result:
- Open Privacy Policy from Settings.
- Open Terms of Use from Settings.
- Create a cloud backup before deletion.
- Click Delete My Account/Data.
- Cancel at first confirmation.
- Cancel at second confirmation.
- Test wrong password.
- Test correct password with a disposable test account.
- Verify Firestore appState is deleted.
- Verify cloud backups are deleted.
- Verify Firebase Auth account is deleted.
- Verify local browser data is cleared.

Notes:

## 11. Dark Mode

- Result:
- Toggle dark mode from the header.
- Toggle dark mode from Settings.
- Verify Home, Transactions, Settings, modals, onboarding, import preview, and calculator remain readable.
- Verify dark mode persists after refresh.
- Verify dark mode syncs after sign-in.

Notes:

## 12. Home Dashboard and Charts

- Result:
- Verify year selector updates dashboard.
- Verify month selector updates dashboard.
- Verify Single View and Joint View update dashboard.
- Verify no automatic scroll happens when changing month/year/view.
- Verify charts render with transactions.
- Verify insights are clickable.
- Verify clicked insight opens related transactions and filters.
- Verify unused categories are hidden from the selected time frame.
- Verify future months are hidden in current-year yearly view.

Notes:

## 13. Mobile Safari

- Result:
- Open live app in iPhone Safari.
- Add to Home Screen.
- Launch from Home Screen.
- Verify splash/standalone app feel.
- Verify bottom nav respects home indicator safe area.
- Add transaction using amount calculator.
- Import preview table can scroll sideways.
- Modals scroll without getting trapped.
- Date picker works.
- Offline banner appears when network is disabled.
- Reconnect and verify sync resumes.

Notes:

## 14. Chrome Android

- Result:
- Open live app in Chrome Android.
- Install app when prompted or from browser menu.
- Launch installed app.
- Verify bottom nav and safe-area spacing.
- Add transaction using numeric keyboard and calculator.
- Import preview table can scroll sideways.
- Modals scroll without getting trapped.
- Date picker works.
- Offline banner appears when network is disabled.
- Reconnect and verify sync resumes.

Notes:

## 15. Offline / Reconnect

- Result:
- Load app while online.
- Turn off network.
- Refresh app and verify cached app shell loads.
- Verify offline banner appears.
- Add a local transaction while offline.
- Reconnect network.
- Verify online banner appears.
- Verify queued local changes sync after reconnect.
- Sign out and verify account actions require network.

Notes:

## 16. Firebase Rules and App Check

- Result:
- Verify signed-in user can read/write own `users/{uid}/budgetTracker/appState`.
- Verify signed-in user cannot read another user's path.
- Verify unauthenticated user cannot read/write app data.
- Create cloud backup and verify document is created under own UID.
- Verify cloud backup cannot be updated after creation.
- If App Check is enabled, monitor App Check metrics before enforcing.
- After enforcement, verify login, sync, backup, and restore still work.

Notes:

## 17. Release Smoke Test

- Result:
- `node --check script.js`
- `node --check service-worker.js`
- Manifest JSON parses.
- Firebase Hosting deploy succeeds.
- Firestore rules deploy succeeds.
- Live app loads in a clean browser.
- Existing user can sign in.
- New user can complete onboarding.
- Test account can create and restore cloud backup.

Notes:

## Known Risks / Follow-Up

- Risk:
- Owner:
- Target date:

