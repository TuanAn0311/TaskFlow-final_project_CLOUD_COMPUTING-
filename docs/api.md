# HTTP API reference

Base path: `/api`. JSON responses use `{ "status": "success" | "error", "message": "...", "data": ... }`. Paginated endpoints also include `pagination` with `page`, `limit`, `total`, and `totalPages`. Protected routes require `Authorization: Bearer <JWT>`.

## Health and authentication

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/health` | Public | API and database readiness |
| `POST` | `/auth/register` | Public, rate limited | Create an employee account (`full_name`, `email`, `password`) |
| `POST` | `/auth/login` | Public, rate limited | Authenticate (`email`, `password`); returns `{ user, token }` |
| `GET` | `/auth/me` | Authenticated | Return the current active user |

Passwords must be at least eight UTF-8 bytes and no more than 72 UTF-8 bytes (the bcrypt input limit). Registration cannot create administrators; use the one-time `seed:admin` operation.

## Users

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/users?page=1&limit=20&role=&is_active=&search=` | Admin | Filtered, paginated directory |
| `GET` | `/users/:id` | Admin or same user | User profile |
| `PATCH` | `/users/:id/status` | Admin | Set `{ "is_active": boolean }`; cannot deactivate the current or last active administrator |

## Tasks

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/tasks` | Authenticated | Paginated task list; supports `search`, `status`, `priority`, `assignee_id`, `due_after`, `due_before`, and admin-only `created_by` |
| `POST` | `/tasks` | Authenticated | Create task (`title`, optional `description`, `priority`, `due_date`, `assignee_ids`) |
| `GET` | `/tasks/:id` | Admin, creator, or active assignee | Task detail |
| `PATCH` | `/tasks/:id` | Admin or creator | Update `title`, `description`, `priority`, or `due_date` |
| `DELETE` | `/tasks/:id` | Admin | Soft-delete task |
| `GET` | `/tasks/:id/documents` | Task reader | List shared task documents |
| `POST` | `/tasks/:id/documents` | Admin or task creator | Upload up to five `files` in multipart form data |
| `GET` | `/tasks/:id/documents/:documentId/url?disposition=inline|attachment` | Task reader | Get a 2-minute signed view/download URL |
| `GET` | `/tasks/:id/reports` | Task reader | List completion reports and report files |
| `GET` | `/tasks/:id/reports/:reportId/documents/:documentId/url?disposition=inline|attachment` | Task reader | Get a 2-minute signed report view/download URL |

Task date filters accept ISO 8601 values. A date-only `due_before` value includes the entire calendar day.

Valid priority values are `low`, `medium`, `high`; task statuses are `unassigned`, `todo`, `in_progress`, `completed`. Employees creating tasks are automatically assigned to those tasks; supplied `assignee_ids` are ignored for employees.

## Assignments

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/tasks/:id/assignments` | Task reader | Read active and revoked assignment history |
| `POST` | `/tasks/:id/assignments` | Admin | Assign one or more active users (`assignee_ids: number[]`) |
| `PATCH` | `/tasks/:id/assignments/:assignmentId/status` | Admin or assignment owner | Change status; optional `note` |
| `POST` | `/tasks/:id/assignments/:assignmentId/report/files` | Admin or assignment owner, while completed | Upload up to five `files` to the latest completion report |
| `PATCH` | `/tasks/:id/assignments/:assignmentId/revoke` | Admin | Revoke active assignment; optional `revoke_reason` |

Allowed status transitions: `todo → in_progress`, `in_progress → todo|completed`, and `completed → in_progress`. Transitions, their history event, and a new completion report are stored transactionally. On a transition to `completed`, the optional JSON field `completion_note` (up to 5,000 characters) is saved as a report; report files can be attached afterward.

File uploads use multipart form data with the field name `files`. Up to five files, 10 MB each, are accepted in PDF, Word, Excel, PowerPoint, TXT, PNG, and JPG formats. Task documents are visible to users who can access that task. Completion reports are separate per completion cycle and assignment; files are private in storage and delivered using short-lived signed URLs.

## History and comments

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/tasks/:id/history?assignment_id=` | Task reader | Read ordered task status/revocation history |
| `GET` | `/tasks/:id/comments?page=1&limit=50` | Task reader | Read paginated comments |
| `POST` | `/tasks/:id/comments` | Task reader | Add `{ "content": "..." }` |
| `PATCH` | `/tasks/:id/comments/:commentId` | Admin or comment author with current task access | Edit content |
| `DELETE` | `/tasks/:id/comments/:commentId` | Admin or comment author with current task access | Soft-delete comment |

Comments are limited to 5,000 characters. Unknown routes return HTTP 404; validation, authentication, authorization, conflict, and not-found errors return non-2xx status codes with a JSON error body.
