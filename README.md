# Beverage shop backend

The existing Express backend now uses PostgreSQL on Neon. The companion frontend remains in P:\BevShopFe and uses its existing React dashboard, components and Tailwind styles.

- Backend structure: app.js, routes, controllers, services, models and middlewares.
- Configuration: DATABASE_URL, DATABASE_URL_UNPOOLED, JWT_SECRET, SETUP_TOKEN and PORT in .env. See .env.example.
- Start: npm run db:migrate, then npm run dev. Start the frontend with npm run dev in P:\BevShopFe.
- First login: create the single owner account with SETUP_TOKEN. Currency is fixed to RWF and the reporting time zone is Africa/Kigali.
- Verify: npm test and npm run lint. After building the frontend, npm run test:browser checks the UI using an isolated PostgreSQL test database and installed Chrome.

Purchases convert packs to individual items, including initial stock during product creation. Supplier purchases, direct sales, expenses and damaged stock post balanced journal entries atomically. Weighted-average costing preserves the full stock cost. Reports support selected daily, weekly, monthly, yearly and custom periods. Price suggestions use a 20% gross margin; the owner can choose a different selling price. Corrections and full sale returns use reversals. Activity can be printed or saved as PDF from the browser.

This version records fully paid transactions in one currency. It does not calculate tax returns, credit balances or import historical MongoDB data. Record transactions in sequence; opening stock and historical balances need reconciliation before live use.

Neon is linked to misty-sound-85215249 / production. neon.ts contains the requested empty policy. neon deploy configures Neon; it does not deploy the Express server or frontend.

Cash reconciliation saves a timestamped comparison of recorded and counted Cash/Mobile Money balances. It does not change the ledger. Physical stock counts post the difference at weighted purchase cost (an explicit unit cost is required for extra stock without any recorded cost). Shortages and gains appear separately in reports. Both features retain their history.

Change the owner password and create a one-time recovery code from Profile. Save the code offline before it is needed. The login recovery page consumes that code to reset the password without deleting shop records. Password changes and recovery revoke existing sessions.

Backups: run `node scripts/configure-backups.js` once. Preserve `BACKUP_KEY` from `.env` offline, separately from the encrypted files. The server backs up at startup if due and every 24 hours while running; it retains the newest 30 copies in `backups/` or `BACKUP_DIR`. For an independent Windows daily job run `powershell -ExecutionPolicy Bypass -File scripts/install-backup-task.ps1` (23:55, while this Windows user is signed in; missed runs catch up). Profile shows available backups and allows encrypted downloads. Keep copies on a separate device; local files alone do not protect against loss of this computer. On a hosted server, set BACKUP_DIR to persistent storage.

Run `npm run db:backup` for a manual backup and `npm run db:restore-check` to decrypt the latest copy into isolated PostgreSQL and compare every table exactly. This check uses the development PGlite dependency and never overwrites Neon. For actual recovery, set RESTORE_DATABASE_URL to a separate empty PostgreSQL database and run `npm run db:restore -- /absolute/path/to/file.bevbackup`. It refuses the live database or an existing shop schema. After verifying the replacement, point DATABASE_URL at it and restart the backend. Preserve the original database until recovery is confirmed.
