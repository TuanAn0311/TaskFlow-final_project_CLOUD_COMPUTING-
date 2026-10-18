# TaskFlow audit report

**Audit date:** 2026-10-17  
**Scope:** Existing backend, database, web client, Expo Android client, and Render configuration. This audit records source-level findings and commands actually executed; it does not certify a live deployment.

## Workspace state

The project root is not a Git repository. `mobile/` is a nested Git repository and had pre-existing modifications in `.gitignore`, `App.js`, `app.json`, `package.json`, `package-lock.json`, plus an untracked `.env.example`. Those changes were retained; this follow-up made a focused `App.js` change to call the shared API URL validator, added `mobile/apiUrlConfig.js` and `mobile/app.config.js`, and updated `web/vite.config.js`, `backend/.env.example`, backend database configuration/tests, and the three requested audit documents. No commit or reset was performed.

## Executive summary

The project is a working full-stack task-management implementation rather than a starter-only scaffold. The backend and web application have functional API-backed flows; the Android client has a production JS export path and uses the same API. Backend API tests and the web/Android bundle checks passed as recorded in [testing.md](./testing.md).

The project is **ready for local demonstration after configuring PostgreSQL and an initial admin**, but **not verified or production-ready for durable cloud data**. Backend integration tests now fail closed unless a separately named test database URL is explicitly configured. No such test URL was provided, so integration tests and migrations were not run. A configured Android emulator was available, but Expo Go failed to download its remote update before the app opened. The Render Blueprint uses Free plans, which have important service/database limits; migrations must be run manually because Free web services do not support pre-deploy commands or Shell/SSH. No Render deployment was performed.

## 1. Actual architecture found

```text
React/Vite web ─┐
                ├── JSON REST API ── Express ── PostgreSQL
Expo/React Native┘
```

- **Backend:** Node.js/Express layered as `routes → controllers → database repositories`, with shared middleware and utilities. PostgreSQL is accessed through one `pg` pool. API writes that change related records use transactions where required.
- **Web:** React/Vite with an MVC-style split: `models/apiModel.js` for HTTP, `controllers/WorkspaceController.jsx` for state/actions, and feature components for views.
- **Mobile:** Expo/React Native in `mobile/App.js`; its single main screen module contains auth, task list/detail, team, comments, assignment, and history flows.
- **Database:** PostgreSQL migrations in `database/migrations`; migration runner tracks applied files and uses an advisory lock and per-migration transaction.
- **Deployment:** `render.yaml` defines PostgreSQL, an API web service, and a static web site. Mobile distribution is separate from the Render Blueprint.

## 2. Implemented features

- Employee registration, login, current-user lookup, bcrypt password hashing, JWT authentication, and rate-limited auth routes.
- Admin/employee role checks on the backend; registration cannot select the admin role. The initial admin is created using the admin seed command.
- Task create/list/detail/update/soft-delete; keyword, priority, status, assignee, creator, and due-date filters; paginated API.
- Multiple active assignees, assignment revocation with preserved records, new record on reassignment, individual progress, and transactional status history.
- Derived overall task status; revoked assignments do not count. Inactive users' existing assignments are not automatically revoked and remain active until an admin revokes them.
- Task comments with author/admin mutation permissions and soft deletion.
- Web dashboard, task list/detail, team administration, task/comment forms, filters, pagination, loading/error/empty states, and responsive CSS.
- Mobile login/register, SecureStore token persistence, task list/search/status filter, task detail, comments/history, assignment/progress actions, and admin team actions.
- API health endpoint checks PostgreSQL; Render variables configure API/web origins and generated JWT secret.

## 3. Missing or incomplete features

- Mobile task and team views fetch at most 100 records and do not expose pagination.
- No mobile lint, type-check, or test script is declared. Device/emulator runtime, secure-store persistence, network failure behavior, and Android navigation were not manually exercised.
- Backend integration tests now fail closed unless `TEST_DATABASE_URL` identifies a database whose name contains a test segment and differs from configured `DB_NAME`. No isolated test URL is configured, so integration tests did not run in this audit.
- No live Render deploy, production health check, real Android release, backup/restore drill, or signed mobile binary was performed.
- The Free Render database is temporary and has no backups; it is unsuitable for durable production data.
- Android production URL validation runs during Expo production config/export and at app runtime. Missing, non-HTTPS, localhost, and private IPv4/IPv6 origins are rejected before export.

## 4. Findings by severity

### P1 — Important deployment/data-operation issue — mitigated with an operational change

**Migration automation was incompatible with the configured Free API plan.** `render.yaml` initially used `preDeployCommand`, but Render supports that feature only on paid web services. The selected plan remains Free, so automatic pre-deploy migration was removed. The documented procedure now requires running migrations from a trusted machine with external database access before the first use and before deploying code that requires a migration. This is manual and remains an operational risk if skipped.

### P1 — Test isolation — local fail-closed safeguard added

The integration suites use direct database cleanup queries. Previously the shared connection could use `DATABASE_URL` or `DB_*`, including the local `.env` configuration, when tests ran. `backend/src/database/config.js` now requires `TEST_DATABASE_URL` in Jest test mode, requires a PostgreSQL URL with a database name containing a distinct `test` segment, refuses to use the same database name as `DB_NAME` or the configured default URL target, and ignores normal connection settings for tests. Six pure configuration tests pass. Integration tests remain unrun because no isolated test database URL is configured; the name check is a safeguard, not proof that a database is disposable.

### P2 — Important integration/configuration issues — fixed or documented

- A fresh mobile login could set the user/token without reliably triggering the task/team effects. Effects now observe auth state; session restoration no longer races those loaders.
- Mobile task details now fetch the task itself along with assignments, history, and comments, avoiding stale list data in the detail panel.
- Web production builds could inherit a local `localhost` API URL. Vite now requires a configured public HTTPS API URL for production and rejects localhost/private hosts.
- Android production no longer defaults to a local URL. Shared validation in `mobile/apiUrlConfig.js` rejects a missing/non-HTTPS/local/private (IPv4 and IPv6) production API URL during Expo config/export as well as at app runtime.
- Expo dependency validation found `expo@~57.0.27` below the SDK-compatible `~57.0.30`. It was updated by one patch release; `npx expo install --check` then passed.
- Mobile `.gitignore` now excludes `.env` and `.env.*` while allowing `.env.example`.

### P3 — Usability/maintenance

- Mobile pagination and more granular list/detail loading states would improve use at larger data volumes.
- Mobile UI/device interaction is source-reviewed and bundle-verified, not accessibility- or device-tested.

## 5. Security findings

### Controls present and source-reviewed

- Passwords are bcrypt-hashed; auth rejects invalid credentials without disclosing account existence.
- JWT authentication resolves current role and active status from the database. Missing, invalid, expired, forged-role, and inactive-user cases have direct API coverage.
- Registration fixes the role to employee; actor IDs come from the authenticated user rather than client-supplied fields.
- Admin-only APIs enforce authorization on the server; employees are scoped to created/assigned tasks and their own assignment updates.
- Auth routes are rate limited; CORS uses configured `WEB_ORIGIN`; Helmet is enabled.
- Production error responses omit internal details, and logger sanitizes sensitive key names.
- No live secret values were read or printed during the audit. Example env files contain placeholders/sample values only.

### Residual security risks

- The web JWT is stored in `localStorage`, increasing token-theft impact if an XSS vulnerability is introduced. Task/comment/user-generated strings are rendered as normal React text; no `dangerouslySetInnerHTML`, `innerHTML`, or other HTML injection sink was found in `web/src`. No confirmed XSS path was identified. No partial HttpOnly-cookie migration was made because a complete migration would require coordinated backend cookie, CSRF, CORS, and client changes.
- Admin/bootstrap credentials and database external URL must be handled outside source control and shell history when running the manual Render procedure.
- `npm audit` and `npm audit --omit=dev` report **22 advisories (15 high, 7 moderate, 0 critical)**. The affected tree includes Expo/Metro and React Native CLI/build packages; advisories also include `braces`, `node-forge`, and `uuid`. npm's available automated remediations downgrade Expo to 44.0.6 or React Native to 0.72.17, major versions incompatible with this SDK. No force fix or unsupported package override was applied. This includes build tooling because Expo is a declared runtime dependency; not all listed packages are shipped in the app bundle.
- No separate penetration test or live production security test was performed.

### Mobile dependency audit detail

Both `npm audit` and `npm audit --omit=dev` returned the same 22 package findings in this lockfile snapshot. npm marks the transitive packages below as production dependencies because they descend from the declared Expo/React Native packages; many are CLI/Metro/native-build tooling and are not necessarily included in the shipped app bundle.

| Package | Severity | Lockfile dependency path | npm automated fix |
|---|---|---|---|
| `@expo/cli` | High | `node_modules/expo/node_modules/@expo/cli` | `expo@44.0.6` (major downgrade) |
| `@expo/code-signing-certificates` | High | `node_modules/@expo/code-signing-certificates` | `expo@44.0.6` (major downgrade) |
| `@expo/config` | Moderate | `node_modules/@expo/config` | `expo@44.0.6` (major downgrade) |
| `@expo/config-plugins` | Moderate | `node_modules/@expo/config-plugins` | `expo@44.0.6` (major downgrade) |
| `@expo/inline-modules` | Moderate | `node_modules/@expo/inline-modules` | `expo@44.0.6` (major downgrade) |
| `@expo/local-build-cache-provider` | Moderate | `node_modules/@expo/local-build-cache-provider` | `expo@44.0.6` (major downgrade) |
| `@expo/metro` | High | `node_modules/@expo/metro` | `expo@44.0.6` (major downgrade) |
| `@expo/metro-config` | High | `node_modules/expo/node_modules/@expo/metro-config` | `expo@44.0.6` (major downgrade) |
| `@expo/prebuild-config` | Moderate | `node_modules/@expo/prebuild-config` | `expo@44.0.6` (major downgrade) |
| `@react-native/community-cli-plugin` | High | `node_modules/@react-native/community-cli-plugin` | `react-native@0.72.17` (major downgrade) |
| `@react-native/virtualized-lists` | High | `node_modules/@react-native/virtualized-lists` | `react-native@0.72.17` (major downgrade) |
| `braces` | High | `node_modules/braces` | `expo@44.0.6` (major downgrade) |
| `expo` | High | `node_modules/expo` (direct dependency) | `expo@44.0.6` (major downgrade) |
| `metro` | High | `node_modules/metro` | `expo@44.0.6` (major downgrade) |
| `metro-config` | High | `node_modules/metro-config` | `expo@44.0.6` (major downgrade) |
| `metro-file-map` | High | `node_modules/metro-file-map` | `expo@44.0.6` (major downgrade) |
| `metro-transform-worker` | High | `node_modules/metro-transform-worker` | `expo@44.0.6` (major downgrade) |
| `micromatch` | High | `node_modules/micromatch` | `expo@44.0.6` (major downgrade) |
| `node-forge` | High | `node_modules/node-forge` | `expo@44.0.6` (major downgrade) |
| `react-native` | High | `node_modules/react-native` (direct dependency) | `react-native@0.72.17` (major downgrade) |
| `uuid` | Moderate | `node_modules/uuid` | `expo@44.0.6` (major downgrade) |
| `xcode` | Moderate | `node_modules/xcode` | `expo@44.0.6` (major downgrade) |

The underlying named advisories include braces stack-exhaustion DoS, node-forge RSA signature verification, and uuid buffer bounds issues. No safe SDK-compatible remediation was identified by npm's automated fix metadata. Keep Expo/React Native aligned with the SDK; resolve these through a future compatible Expo SDK/package release and rerun the audit rather than applying the suggested downgrades.

## 6. Database and migration findings

- Expected core tables exist in migrations: `users`, `tasks`, `task_assignments`, `task_status_history`, and `task_comments`; migration history is tracked in `schema_migrations`.
- Schema uses identity primary keys, email uniqueness, enums/checks, foreign keys, indexes, one active assignment per task/user pair, and soft-delete fields.
- Migration 009 enforces completion and revocation metadata consistency after validating existing rows. It was previously applied to the configured database in an earlier audit; the current audit did not access or modify a database.
- Assignment history is preserved on revoke/reassignment. Task status changes and history writes are transactional.
- The migration runner is idempotent by filename tracking and serializes concurrent runs with an advisory lock.
- Render migration invocation is manual under the selected Free plan. Free PostgreSQL expiry and lack of backups make it unsuitable for retained production data.
- Test runs now require `TEST_DATABASE_URL` whose database name has a `test` segment and differs from `DB_NAME` and the configured default URL target; a normal `DATABASE_URL` or `DB_*` is never used by the Jest pool. The guard does not prove that the configured server is disposable, so an owner must verify it before setting the URL.
- Six database-configuration unit tests passed. The full Jest command reports the two database integration suites blocked before test execution when `TEST_DATABASE_URL` is unset; those suites did not connect to PostgreSQL in that run.
- An integration command was inadvertently started before the new guard existed: `npm test -- --runInBand __tests__/api-core.test.js`. It was stopped after roughly 30 seconds; only a dotenv-loaded message had appeared, and there was no Jest result. Whether any test had already changed or cleaned test records could not be established. No further database command or cleanup was run; the user was notified to inspect the database.

## 7. Frontend/backend integration findings

- Both clients call the backend `/api` routes for auth, tasks, assignments, task history, comments, and (admin-only) users.
- Direct API tests previously verified core role, task, assignment, comment, validation, and auth boundaries. The web build and Android export succeeded with a configured API URL.
- Web and Android now require/configure their API origin independently (`VITE_API_URL`, `EXPO_PUBLIC_API_URL`). Production build artifacts with the HTTPS fixture URL contained that URL and did not contain the local fallback.
- Admin/employee behavior is presentation-aware, but backend authorization remains the security boundary.
- Web detail loading and task refresh behavior were corrected. Mobile has loading/error/empty patterns, but list and team pagination are not implemented.

## 8. Mobile-specific findings

- Expo SecureStore is configured and used for the auth token; API requests use the shared mobile helper.
- API origin is configurable. Emulator/simulator defaults are development-only; a production URL must be configured.
- Admin team navigation is role-gated, while backend admin routes enforce the actual permission.
- Android SDK and a `Pixel_7` AVD were available. Expo Go launched but reported `java.io.IOException: Failed to download remote update`; the app screen did not load, so login/task UI flows were not tested. The emulator and local Metro server were stopped afterward.
- Both inspectable (`--no-bytecode`) and optimized Hermes-bytecode `npx expo export --platform android` runs passed with an HTTPS fixture. The inspectable JS bundle contained the configured API origin and did not contain localhost or the Android emulator fallback. These are JS exports, not a native APK or a device runtime pass.
- Production Expo config/export rejects a missing URL, `http://localhost:3000`, private IPv4, IPv6 loopback, and IPv6 ULA. Runtime flows remain unverified.
- `mobile/package.json` declares only `start`, `android`, `ios`, and `web` scripts; there are no project lint/type-check/test scripts.
- Expo compatibility check passes after the Expo patch update. Mobile `npm audit --omit=dev` remains nonzero due advisories.
- The Android production URL is now validated at build/config time as well as at runtime; only a fixture URL was used for the local export, not a deployed service.

## 9. Cloud deployment readiness

- Backend listens on `process.env.PORT`, validates startup secrets/port, checks PostgreSQL before listening, and logs startup failures safely.
- Health check is `GET /api/health` and includes a database query.
- Render Blueprint injects `DATABASE_URL`, generates `JWT_SECRET`, sets one trusted proxy hop, and maps web/API hosts into `WEB_ORIGIN` and `VITE_API_URL`.
- PostgreSQL TLS is configurable through `DB_SSL` and `DB_SSL_REJECT_UNAUTHORIZED`. For Render external PostgreSQL access, enable TLS (`DB_SSL=true`); use internal connection URL from a same-region service when possible. Render internal connections can optionally use TLS; external connections require TLS. See [Render PostgreSQL connections](https://render.com/docs/postgresql-creating-connecting).
- Production web build now fails without an HTTPS public API origin or with a local/private host. Android uses `EXPO_PUBLIC_API_URL`; configure it to the deployed HTTPS API URL at build time.
- `.env.example` files are templates; project/mobile ignore rules exclude real `.env` files.
- **Not verified:** Render Blueprint validation/deployment, live CORS, Render database SSL handshake, API cold start, real API health endpoint in cloud, and production EAS build.
- Account access is required to link the Git provider, apply the Blueprint, choose durable paid PostgreSQL, set admin credentials, and publish mobile binaries.

## 10. Commands executed and results

See [testing.md](./testing.md) for the command-by-command status, including known failed and not-run checks.

Key recorded results:

- Backend `npm test -- --runInBand`: **2 suites, 23 tests passed** in the previous audit run; database isolation was not proven.
- Backend `npm test -- --runInBand __tests__/database-config.test.js`: **1 suite, 6 tests passed**; pure configuration tests did not use PostgreSQL.
- Backend full `npm test -- --runInBand` after adding the guard: **3 suites discovered; 1 suite passed (6 tests), 2 integration suites refused to load without `TEST_DATABASE_URL`**. This is a deliberate safe block, not an integration pass.
- Web `npm run build` with HTTPS `VITE_API_URL`: **passed**; configured API URL present, local fallback absent.
- Vite production guard checks: localhost and private-IP API origins were **rejected** as expected.
- Android `npx expo export --platform android --no-bytecode` and optimized Hermes-bytecode export with HTTPS `EXPO_PUBLIC_API_URL`: **passed**; inspectable JS contained the configured URL and no localhost/emulator fallback.
- Android config/export with missing, localhost, private IPv4, IPv6 loopback, and IPv6 ULA URLs: **rejected as expected**.
- `npx expo install --check`: **passed** after Expo patch update.
- `npm audit` and `npm audit --omit=dev`: **nonzero** with 22 advisories (15 high, 7 moderate).
- Pixel_7 emulator started; Expo Go failed to download a remote update, so application runtime testing did not complete.
- Render CLI validation and cloud deployment: **not run**; Render CLI was unavailable.

## 11. Remaining risks and limitations

1. Free Render PostgreSQL expires and has no backups. Upgrade and plan retention/backup/restore before storing important data.
2. Manual migration ordering can be missed. If remaining on Free, disable automatic deploys around a schema release, migrate using the matching source revision from a trusted machine, then deploy that revision.
3. The backend test guard checks an explicit URL and database-name marker, but cannot establish ownership/disposability of its PostgreSQL server; verify it before running integration tests again.
4. Mobile runtime flows could not be tested because Expo Go failed to download its remote update; mobile also lacks task/team pagination.
5. Mobile dependency audit advisories remain unresolved; do not apply a breaking `--force` downgrade without a compatible upgrade path.
6. Web `localStorage` token storage remains an XSS-related risk.
7. No Render deployment, production health check, EAS binary, backup, or restore has been verified.
