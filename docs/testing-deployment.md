# Testing and deployment

## Automated verification

Backend integration tests use Jest, Supertest, and a real PostgreSQL database. They exercise registration/login, duplicate registration, employee self-assignment, role-gated user listing and account status, assignment transitions/history, task edits, assignments, and comments.

```powershell
cd backend
npm ci
npm test -- --runInBand
```

Use a dedicated database for tests; test cleanup removes only records created by the suite. Initialize or update the schema with:

```powershell
npm run migrate
```

File storage helper tests run without a Supabase account. To exercise uploads end to end, configure a private Supabase Storage bucket using `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`; do not use a production bucket for test uploads.

Web production bundle:

```powershell
cd ..\web
npm ci
$env:VITE_API_URL = "https://api.example.com" # Replace with the deployed API URL; Render sets this from render.yaml.
npm run build
Remove-Item Env:VITE_API_URL
```

Mobile Android JS bundle/export:

```powershell
cd ..\mobile
npm ci
$env:EXPO_PUBLIC_API_URL = "https://api.example.com" # Replace with the HTTPS API URL.
npx expo export --platform android
Remove-Item Env:EXPO_PUBLIC_API_URL
```

An Expo export validates bundling; it does not replace testing on physical iOS/Android devices. Verify permissions, device networking, keyboard behavior, and secure token persistence on target devices.

## Render Blueprint

The root `render.yaml` provisions a PostgreSQL 16 database, a Node API, and a static Vite site. Review the provider's pricing, supported region, and current free-tier persistence/expiry limitations before provisioning. Free database plans are not suitable for durable production data.

Deployment sequence:

1. Push the source repository to a remote Git provider and create a Render Blueprint from it.
2. Review the three resources and apply the Blueprint. Render generates `JWT_SECRET` and connects the API to the database.
3. After the Blueprint creates the database, run the migrations from a trusted local machine with access to the Render PostgreSQL external URL. In the `backend/` directory, provide that URL as `DATABASE_URL`, set `DB_SSL=true`, then run `npm run migrate`. Do not use the API until migrations finish. Before later deploys that introduce migrations, disable automatic deploys, run the migration from the matching source commit first, and then manually deploy that commit. Use backward-compatible migrations. Do not put the URL in source control, shell history, or logs; clear temporary environment variables afterward. The migration runner uses a PostgreSQL advisory lock and applies each migration transactionally. Render Free web services do not provide Dashboard Shell/SSH or pre-deploy commands.
4. Confirm `/api/health` reports success after the database is migrated and the API is deployed.
5. The static site gets the API host as `VITE_API_URL`; the API gets the static-site host as `WEB_ORIGIN`.
6. Create a private Supabase Storage bucket (default name `taskflow-files`) and set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the API service. Keep the service-role key only in the API environment; never expose it to the browser or mobile bundle. Review the Supabase free-plan quota and retention limits.
7. Create the initial administrator from the trusted local machine after migrations: set `DATABASE_URL` to the Render external URL, `DB_SSL=true`, and provide `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optionally `ADMIN_NAME` as temporary environment variables, then run `npm run seed:admin` from `backend/`. Do not put credentials in source control, shell history, or logs; clear the temporary variables afterward. The seed is safe to rerun for an existing email and does not change that account.
8. Configure a durable PostgreSQL plan and backups for real data. Do not use the development seed in production.
9. For mobile, set `EXPO_PUBLIC_API_URL` to the deployed HTTPS API URL at build time. Build/distribute separately using Expo/EAS; do not embed JWT/database/admin secrets in the app.

The Blueprint uses a Free API plan, so migrations must be run manually from a machine that can reach the database. Free Render Postgres is temporary (30-day lifetime) and has no backups; upgrade it before storing data that must be retained.

## Release checklist

- [ ] Set a high-entropy JWT secret and protect service environment access.
- [ ] Use HTTPS for browser, API, and production mobile traffic.
- [ ] Restrict `WEB_ORIGIN` to the deployed web origin; native clients do not need CORS.
- [ ] Configure `TRUST_PROXY_HOPS` to match the exact number of trusted reverse proxies (`1` for the Render Blueprint); do not trust arbitrary forwarded headers.
- [ ] Use a durable managed PostgreSQL plan, automated backups, and a tested restore procedure.
- [ ] Apply migrations and create the initial admin; disable/delete seed/demo accounts.
- [ ] Run backend integration tests and web/mobile bundle checks against the release commit.
- [ ] Test role boundaries, expired/disabled accounts, assignment transitions, comments, and migration rollback/recovery procedures.
- [ ] Monitor API errors and database health; do not expose stack traces or credentials in logs.

## Known external prerequisites

Creating a Render account/project, selecting a paid database plan, configuring custom domains, and publishing signed mobile binaries require owner-controlled provider accounts and credentials. The repository contains deployment configuration and instructions but cannot perform those account-bound actions by itself.
