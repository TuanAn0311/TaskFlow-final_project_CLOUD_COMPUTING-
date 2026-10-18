# TaskFlow testing record

**Updated:** 2026-10-17  
This document distinguishes executed checks from source inspection and from tests that could not safely be run.

## Tests passed

| Command/check | Result |
|---|---|
| Backend `npm test -- --runInBand` (recorded during the preceding business/web audit) | **Passed:** 2 Jest suites, 23 tests. Includes API-level authentication/authorization and task/assignment/history/comment coverage. This is a prior recorded result, not a new run in the cloud/config audit. |
| Backend `npm test -- --runInBand __tests__/database-config.test.js` | **Passed:** 1 suite, 6 tests. Pure configuration tests; no PostgreSQL connection. |
| Web `npm run build` with `VITE_API_URL=https://taskflow-api.example.invalid` | **Passed:** production bundle built; fixture API origin was embedded and `http://localhost:3000` was absent. |
| Web production artifact scan | **Passed:** configured HTTPS fixture present; localhost fallback and `JWT_SECRET=`, `DATABASE_URL=`, `DB_PASSWORD=`, `ADMIN_PASSWORD=` markers absent. This checks markers only and does not read local secret values. |
| `npx vite build --outDir <temporary-dir>` with `VITE_API_URL=http://localhost:3000` | **Expected rejection:** Vite refused a local production endpoint. |
| `npx vite build --outDir <temporary-dir>` with `VITE_API_URL=http://10.0.0.8:3000` | **Expected rejection:** Vite refused a private-network production endpoint. |
| Web production build with IPv6 loopback, ULA, and link-local API origins | **Expected rejection:** Vite refused all three local/private IPv6 origins. |
| `npx expo install --check` in `mobile/` | **Passed** after aligning Expo to `~57.0.30`. |
| `npx expo config --type public --json` with `NODE_ENV=production` and `EXPO_PUBLIC_API_URL=https://taskflow-api.example.invalid` | **Passed:** production Expo config resolved. |
| `npx expo export --platform android --no-bytecode --output-dir <temporary-dir>` with `EXPO_PUBLIC_API_URL=https://taskflow-api.example.invalid` | **Passed:** inspectable Android JS bundle exported; configured origin was present and localhost/emulator fallback was absent. Temporary output was removed. |
| `npx expo export --platform android --output-dir <temporary-dir>` with `NODE_ENV=production` and the HTTPS fixture API URL | **Passed:** optimized Hermes bytecode bundle generated; temporary output was removed. |
| Android production artifact scan | **Passed:** configured HTTPS fixture present; local fallback and secret configuration markers absent. This checks markers only and does not read local secret values. |
| `NODE_ENV=production npx expo export --platform android` with `EXPO_PUBLIC_API_URL=http://localhost:3000` | **Expected rejection:** dynamic Expo config stopped export before bundling. |
| Production Expo config with no `EXPO_PUBLIC_API_URL`, and with private IPv4, IPv6 loopback, or IPv6 ULA URLs | **Expected rejection:** all invalid configurations were refused before export. |
| `npm ls expo expo-secure-store expo-status-bar react react-native --depth=0` | **Passed:** declared top-level mobile dependencies resolved. |
| Editor diagnostics for changed web/mobile source files | **Passed:** no reported diagnostics. |
| `git check-ignore -v .env .env.production` in the mobile repository | **Passed:** both local env file names are ignored. |

### Expected rejection checks

The web guard checks above intentionally return a nonzero build result for unsafe production origins; this is expected behavior, not an unresolved build failure.

The Android production URL guard previously existed only in app runtime, allowing Expo export to bundle a bad explicit URL. `mobile/app.config.js` now uses the shared `mobile/apiUrlConfig.js` policy before production export; missing, localhost, private IPv4, IPv6 loopback, and IPv6 ULA negative checks failed as intended. The valid production URL was a non-routable `.invalid` fixture used only to validate configuration and bundle contents, not to contact a real API.

## Tests failed

| Command/check | Actual result |
|---|---|
| `npm audit --json` and `npm audit --omit=dev --json` in `mobile/` | **Failed/nonzero (exit 1):** both reported 22 advisories (15 high, 7 moderate, 0 critical). npm's only automatic suggestions downgrade Expo to 44.0.6 or React Native to 0.72.17, major changes incompatible with the current SDK; neither was applied. The full package/path list is in [audit-report.md](./audit-report.md). |
| First `npx expo install --check` before the patch update | **Failed/nonzero:** reported installed Expo `~57.0.27` versus expected `~57.0.30`. Fixed by a patch-only update; the subsequent compatibility check passed. |
| Initial production URL artifact assertion before Vite/mobile URL corrections | **Failed as an audit check:** localhost was present in a production bundle built from local configuration. This finding led to the Vite production guard, removal of mobile's production localhost fallback, and Expo build-time URL validation. Corrected HTTPS fixture checks passed for web and Android. |
| Expo Go runtime attempt on the `Pixel_7` AVD | **Blocked:** Expo Go displayed `java.io.IOException: Failed to download remote update`; the TaskFlow UI did not open. No login or API flow was attempted. |

## Tests not run

- Backend integration tests against PostgreSQL; no isolated test URL was configured. The suite now refuses to load without one.
- Database migration or migration rollback against any database during this audit.
- Live `/api/health` request to a deployed cloud service.
- Real web login, registration, and task mutations in the browser against a running API.
- Android login/task runtime flows, real API authentication, offline/network-failure behavior, navigation, and SecureStore persistence. The configured emulator was started, but Expo Go could not load the update.
- EAS/Play Store signed release build.
- Backup and restore drill.

## Tests blocked by missing tools or services

- **Backend integration isolation:** `backend/src/database/config.js` now rejects test mode unless `TEST_DATABASE_URL` contains a PostgreSQL database name with a distinct `test` segment and that name differs from `DB_NAME` and the configured default database target. With the URL unset, `npm test -- --runInBand` reported 1 passing config suite (6 tests) and 2 integration suites refused before connecting. Do not set the URL until a separately provisioned disposable DB is verified.
- **Earlier interrupted test invocation:** before adding the guard, `npm test -- --runInBand __tests__/api-core.test.js` was accidentally started against the backend's default `.env` configuration and stopped after about 30 seconds. Only dotenv's load message had appeared; there was no test result. It is unknown whether any test record was written or cleaned up. The user was notified; no further database access or cleanup was performed.
- **Android emulator:** Android SDK and a `Pixel_7` AVD were present and the emulator booted. Expo Go then failed to download a remote update, so this is an environment/runtime blocker, not a verified TaskFlow screen failure.
- **Render CLI/Blueprint validation:** `Get-Command render` returned no executable; no Render account/API credentials were used.
- **Render cloud checks:** no account-bound deployment or hosted database was available to this session. Render resources were reviewed from repository config and official documentation only.
- **Lint/type-check:** backend, web, and mobile package manifests do not declare dedicated lint/type-check scripts. Editor diagnostics were available for the changed files only.

## Local run commands

Use separate PowerShell terminals from the project root:

```powershell
# Terminal 1: backend, after configuring backend/.env and migrating a local development DB
cd backend
npm ci
npm run migrate
npm run dev
```

```powershell
# Terminal 2: web
cd web
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

```powershell
# Terminal 3: Expo app; set mobile/.env to the reachable API URL first
cd mobile
npm ci
npm start
```

For backend integration tests, first provision and verify a dedicated, disposable PostgreSQL database. Add its URL as `TEST_DATABASE_URL` in `backend/.env`; its database name must include a separate `test` segment (for example, `taskflow_test`) and must differ from `DB_NAME`. Never point it at development/production data. Then, from `backend/`, run:

```powershell
$env:NODE_ENV = 'test'
npm run migrate
if ($LASTEXITCODE -eq 0) {
  npm test -- --runInBand
}
$testExitCode = $LASTEXITCODE
Remove-Item Env:NODE_ENV
exit $testExitCode
```

In test mode, migration and tests use `TEST_DATABASE_URL`, not `DATABASE_URL`/`DB_*`. The test URL must be configured from a safe local secret source. Do not run migration/tests against a database whose purpose/contents are unknown. The interrupted invocation noted above still requires the owner to inspect the previously configured database. For Render Free, migration/admin bootstrap require a trusted local machine with database access; see [testing-deployment.md](./testing-deployment.md).

## Manual verification still required

1. Inspect the database after the interrupted invocation described above. Before backend integration tests, confirm `TEST_DATABASE_URL` points at a separately provisioned disposable database; apply migrations to that test database first, then run `npm test -- --runInBand`.
2. Exercise registration/login, failed login, employee/admin boundaries, task create/edit, multi-assignment, revoke/reassign, progress/history, search/filter, and comments through the running web/mobile clients.
3. Run mobile on an Android emulator and a physical device; verify deployed HTTPS connectivity, offline errors, navigation, keyboard behavior, and SecureStore persistence across restart/logout.
4. Create a Render Blueprint in the owner account; use durable PostgreSQL with backups; run migrations before the relevant deployment; verify `/api/health`, actual CORS origin, mobile API origin, and database TLS.
5. Perform a backup restore test and decide how to mitigate mobile dependency advisories and web `localStorage` token exposure.
