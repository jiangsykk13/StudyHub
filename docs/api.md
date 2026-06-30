# API

The NestJS API is mounted under `/api`. Development OpenAPI documentation is exposed at `/api/docs`.

## Main Resource Groups

- `GET /api/health`: API health.
- `GET /api/health/database`: database health.
- `GET /api/health/storage`: storage health.
- `GET /api/health/ready`: readiness check for API, PostgreSQL, and private object storage.
- `/api/auth`: CSRF, invitation registration, login, logout, and current user.
- `/api/users`: profile access.
- `/api/semesters`: semester management.
- `/api/courses`: course, membership, and course-scoped invitation operations.
- `/api/invitations`: invitation validation, creation, listing, and revocation.
- `/api/resources`: resource metadata, upload, versioning, preview, download, soft delete, and restore.
- `/api/notes`: note drafts, publishing, revisions, restore, and deletion.
- `/api/favorites`: resource and note favorites.
- `/api/profile`: personal activity and quota summary.
- `/api/admin`: administrative user, resource, course, invitation, and audit operations.
- `/api/audit`: audit log listing with filters.

Errors use a safe object shape:

```json
{
  "code": "MACHINE_READABLE_CODE",
  "message": "Safe user-facing message"
}
```

## Implemented Endpoints

Authentication is required unless noted otherwise. Unsafe methods require a trusted `Origin` header and a matching CSRF token.

### Auth

- `GET /api/auth/csrf`: public CSRF token and CSRF cookie.
- `POST /api/auth/register`: public registration through a valid invitation code.
- `POST /api/auth/login`: public email/password login.
- `POST /api/auth/logout`: revoke the current session.
- `GET /api/auth/me`: current user and course memberships.

### Semesters

- `GET /api/semesters`: system administrators see all semesters; other users see semesters containing their active course memberships.
- `POST /api/semesters`: system administrator only.
- `PATCH /api/semesters/:semesterId`: system administrator only.
- `POST /api/semesters/:semesterId/archive`: system administrator only.

### Courses And Memberships

- `GET /api/courses`: system administrators see all active courses; members see only their active course memberships.
- `GET /api/courses/:courseId`: system administrators and active course members only.
- `POST /api/courses`: system administrator only.
- `PATCH /api/courses/:courseId`: system administrator only.
- `POST /api/courses/:courseId/archive`: system administrator only.
- `POST /api/courses/:courseId/members`: system administrators and course administrators for that course.
- `PATCH /api/courses/:courseId/members/:userId`: system administrators and course administrators for that course.

### Invitations

- `GET /api/invitations`: system administrators see all invitations; course administrators see invitations for courses they administer.
- `POST /api/invitations`: system administrators can create all-site or course invitations; course administrators can create invitations only for their own course.
- `POST /api/invitations/:invitationId/revoke`: system administrators can revoke any invitation; course administrators can revoke invitations for their own course.

Invitation creation returns the raw invitation code once. Listing and revoke responses never include raw codes or code hashes.

### Resources

- `GET /api/resources/categories`: list configured resource categories.
- `GET /api/resources`: list resources visible to the authenticated user. Query parameters: `q`, `courseId`, `categoryKey`, `tag`, `sort`, `page`, and `pageSize`.
- `POST /api/resources`: multipart upload with fields `title`, `description`, `courseId`, `categoryKey`, `visibility`, `tags`, and file field `file`.
- `GET /api/resources/:resourceId`: resource metadata and version history for an authorized resource.
- `GET /api/resources/:resourceId/preview`: authorized preview state for PDF, image, Markdown, text/source, notebook, or unsupported download-only files.
- `PATCH /api/resources/:resourceId`: update editable metadata for owner, course admin, or system admin.
- `POST /api/resources/:resourceId/versions`: multipart replacement upload that creates an immutable new `ResourceVersion`.
- `POST /api/resources/:resourceId/download`: authorize access, create a download record, and return a short-lived presigned URL.
- `POST /api/resources/:resourceId/delete`: soft delete for owner, course admin, or system admin.
- `POST /api/resources/:resourceId/restore`: restore a soft-deleted resource for an authorized mutator.

Uploads are parsed as streaming multipart requests with Busboy. The API writes the upload to a temporary file while calculating SHA-256, validates size, quota, extension, and basic signature/MIME rules, rejects exact duplicates in the same course, then streams the validated file into private S3/MinIO storage under a random object key. Original filenames are stored only as database metadata.

Metadata search covers title, description, course code/title, category key/label, tags, uploader name/email, and original filenames. Preview requests perform the same authorization checks as resource detail/download requests. Markdown, source/text, and notebook previews are rendered server-side and sanitized before the API returns HTML. PDF and image previews use short-lived inline presigned URLs. Office documents and ZIP archives remain download-only in the MVP.

### Notes

- `GET /api/notes`: list notes visible to the authenticated user. Query parameters: `q`, `courseId`, `page`, and `pageSize`.
- `POST /api/notes`: create a draft note for a course where the user can contribute.
- `GET /api/notes/:noteId`: note detail, rendered sanitized HTML, table of contents, revision history, and edit/favorite flags for an authorized note.
- `PATCH /api/notes/:noteId`: save draft fields or publish content. `publish: true` creates a `NoteRevision`.
- `POST /api/notes/:noteId/delete`: soft delete for the author, course admin, or system admin.
- `POST /api/notes/:noteId/restore`: restore a soft-deleted note for an authorized mutator.
- `POST /api/notes/:noteId/revisions/:revisionId/restore`: restore a prior revision and create a new auditable revision snapshot.

Published note HTML is generated by the API from GitHub-flavored Markdown, KaTeX math, highlighted code blocks, safe Mermaid blocks, and heading-derived table-of-contents entries. The API sanitizes the final HTML and strips unsafe HTML, script surfaces, and unsafe URL schemes before returning it. Users who can view a published note but cannot edit it receive `draftContent: null`; unpublished drafts are visible only to the author, course administrators for the course, and system administrators.

### Favorites

- `GET /api/favorites`: list the signed-in user's visible resource and note favorites.
- `POST /api/favorites`: add a resource or note favorite after re-checking target visibility.
- `POST /api/favorites/remove`: remove a resource or note favorite for the signed-in user.

Favorites are unique per user and item. The database enforces this with partial unique indexes for resource and note targets, and the API also handles duplicate favorite requests idempotently.

### Profile

- `GET /api/profile/summary`: own upload count, authored note count, favorite count, recent uploads/notes, and storage quota usage.

### Administration

- `GET /api/admin/users`: system-admin user search with status, role, memberships, activity counts, and active session count.
- `POST /api/admin/users/:userId/disable`: system-admin account disable plus active-session revocation.
- `POST /api/admin/users/:userId/enable`: system-admin account re-enable.
- `POST /api/admin/users/:userId/revoke-sessions`: system-admin active-session revocation.
- `GET /api/admin/resources`: resource moderation list with status filters, course filters, metadata search, and duplicate SHA-256 counts. System administrators see all resources; course administrators see only their administered courses.
- `POST /api/admin/resources/:resourceId/delete`: soft-delete a resource within the caller's administrative scope.
- `POST /api/admin/resources/:resourceId/restore`: restore a soft-deleted resource within the caller's administrative scope.
- `GET /api/admin/audit`: audit log listing with action, course, actor, target-type, pagination, and course-admin scope filtering.

Administrative user actions are system-admin-only. Resource moderation and audit-log listing are global for system administrators and course-scoped for course administrators. Ordinary members and read-only members are rejected server-side.
