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

## Deploy lên Render

Xem [hướng dẫn deploy Render](./deploy-render.md) để tạo tài nguyên, cấu hình Supabase, tạo tài khoản admin và kiểm tra website/API. Blueprint trong `render.yaml` chạy migration khi API khởi động.

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
