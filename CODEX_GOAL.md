# CODEX_GOAL.md

## How to start this Goal

Place this file and `AGENTS.md` in the root of an empty project directory. Open that directory in the Codex app, IDE extension, or CLI, then enter:

```text
/goal Build the complete private student material-sharing MVP specified in CODEX_GOAL.md. Read AGENTS.md and CODEX_GOAL.md first, then work milestone by milestone until every required acceptance check is satisfied. Keep docs/progress.md current, verify each milestone with executable tests, and do not declare completion for placeholder or untested behavior. Preserve all security and scope constraints. If genuinely blocked after reasonable attempts, stop with the exact evidence, attempted fixes, and minimum input needed.
```

Goal mode is persistent. This file contains the detailed contract so the `/goal` command can remain short.

---

## 1. Desired end state

Starting from an empty directory, produce a polished, locally runnable MVP named `StudyHub`: an invitation-only private platform where authenticated students can organize course spaces, upload and download learning materials, preview supported files, write shared Markdown notes, search metadata, save favorites, and administer users and courses.

The final repository must be a working full-stack system rather than a UI mockup. A new developer must be able to clone the repository, copy `.env.example` to `.env`, start dependencies, migrate and seed the database, run the application, execute tests, and understand deployment and backup procedures from the documentation.

Use `AGENTS.md` as the durable engineering and security policy.

---

## 2. Evidence required for completion

Do not complete the Goal until all of the following evidence exists:

1. `pnpm install` succeeds from a clean checkout.
2. Docker Compose starts PostgreSQL and MinIO with documented health checks.
3. Prisma migrations apply successfully to an empty database.
4. The seed command creates a usable development admin, semester, sample course, users with different roles, invitation codes, and representative materials without committing real secrets.
5. `pnpm dev` starts the web and API applications.
6. `pnpm build`, `pnpm lint`, `pnpm typecheck`, and required formatting checks pass.
7. unit and integration test suites pass.
8. Playwright E2E tests pass against the running local stack.
9. anonymous users cannot access protected course data or permanent file URLs.
10. authorized users can register, log in, view courses, upload, preview, download, search, create a note, favorite content, and log out.
11. role restrictions are proven by tests, especially read-only, course-admin, owner, and system-admin boundaries.
12. the MinIO bucket remains private and authorized downloads use short-lived presigned URLs.
13. a fresh setup and a backup/restore exercise are documented.
14. there are no required placeholder handlers, fake success responses, disabled security controls, unexplained skipped tests, or committed secrets.
15. `docs/progress.md` records each milestone, verification commands, important decisions, remaining non-MVP work, and final results.

If an exact acceptance item cannot be achieved because of an external environmental blocker, keep the Goal active while alternatives remain. When no defensible path remains, stop with a precise blocker report rather than claiming success.

---

## 3. Product scope

### Users and access

Implement:

- email/password registration only through a valid invitation;
- login and logout;
- opaque server-side sessions in secure cookies;
- session expiration and revocation;
- disabled-user enforcement;
- profile page;
- system administrator, normal member, read-only member, and course-scoped administrator permissions.

Do not implement:

- public registration;
- anonymous browsing of materials;
- OAuth/social login;
- public profile discovery;
- payment or subscription features.

### Courses and semesters

Implement:

- semester CRUD for system administrators;
- course CRUD for system administrators;
- course list and course-detail pages;
- active course memberships;
- member role changes by authorized administrators;
- course-specific invitations with expiry, usage limits, revocation, and hashed codes;
- an all-site invitation option only for a system administrator;
- course materials and notes grouped inside the course space.

### Learning materials

Implement:

- categories such as lecture slides, notes, references, assignments, labs, past exams, project code, review summaries, and other;
- resource title, description, course, category, tags, visibility, uploader, timestamps, original filename, size, MIME type, and SHA-256;
- streaming upload with server-side validation;
- configurable 100 MiB default file limit and 5 GiB default per-user quota;
- exact-duplicate detection based on SHA-256;
- resource updates through immutable `ResourceVersion` records;
- soft deletion and administrative restoration where practical;
- single-file authorized download;
- download audit/count record;
- metadata search and filtering;
- pagination and sorting;
- favorites;
- owner/course-admin/system-admin edit and delete rules.

Batch download may be omitted from the MVP if all required single-file flows are complete and tested. Record it as future work rather than implementing an unsafe or memory-heavy shortcut.

### Previews

Implement safe browser previews for:

- PDF;
- Markdown;
- PNG/JPEG/WebP/GIF images;
- plain-text files;
- common source-code and configuration files;
- Jupyter notebooks as sanitized, read-only content when feasible without executing code.

Office documents and ZIP archives may show metadata and a download action instead of an inline preview. Clearly label unsupported previews.

Never execute uploaded code, notebooks, macros, or archives.

### Notes

Implement:

- create, edit, draft autosave, publish, view, and soft delete;
- course association;
- private-to-author, course-members, or all-authenticated-members visibility where authorized;
- GitHub-flavored Markdown;
- sanitized HTML;
- code highlighting;
- KaTeX math;
- safe Mermaid diagrams;
- table of contents;
- note revision snapshots;
- revision history and restore;
- favorites.

A note editor must preserve unsaved draft work during ordinary navigation or refresh where feasible.

### Administration and auditing

Implement administrator pages for:

- user search, role/status display, disabling/enabling users;
- revoking all sessions for a user;
- semester and course management;
- invitation creation, listing, expiry, usage, and revocation;
- course membership management;
- resource lookup, soft deletion, restoration, and duplicate inspection;
- audit-log listing with filters.

Create audit entries for security-sensitive or destructive actions, including:

- user disable/enable;
- role or membership-role change;
- invitation creation/revocation;
- course creation/update/archive;
- resource deletion/restoration;
- administrative session revocation.

Audit records must not contain raw invitation codes, passwords, session tokens, cookie values, or presigned URLs.

---

## 4. Architecture to create

Create a pnpm/Turborepo monorepo matching `AGENTS.md`.

### Web application

Use Next.js App Router and TypeScript.

Required route groups or equivalent pages:

```text
/login
/register
/dashboard
/courses
/courses/[courseId]
/materials
/materials/[resourceId]
/materials/upload
/notes
/notes/new
/notes/[noteId]
/notes/[noteId]/edit
/favorites
/profile
/admin/users
/admin/courses
/admin/invitations
/admin/resources
/admin/audit
```

Use server rendering where it improves access control and initial loading, but do not duplicate business authorization in the frontend. All authoritative checks remain in the API.

### API application

Use NestJS modules with REST APIs for:

- health;
- auth;
- users/profile;
- semesters;
- courses/memberships;
- invitations;
- resources/versions/downloads;
- notes/revisions;
- favorites;
- administration;
- audit logs;
- storage.

Expose an OpenAPI document in development and keep error responses consistent.

### Shared packages

Create shared packages for:

- environment/config validation;
- common types and Zod schemas;
- reusable UI components;
- lint/TypeScript configuration.

Do not publish internal packages to a registry.

### Infrastructure

Docker Compose must provide at least:

- PostgreSQL;
- MinIO;
- a deterministic bucket initialization step or script.

Use named volumes for local development, health checks, and non-production credentials sourced from `.env`.

The applications may run on the host through `pnpm dev`; containerizing the apps for production is also required by the final deployment documentation and should include production Dockerfiles or an equivalent reproducible deployment artifact.

---

## 5. Security implementation contract

Treat this as acceptance criteria, not optional advice.

### Passwords and sessions

- hash passwords with Argon2id;
- enforce a reasonable password policy without arbitrary complexity theater;
- generate session tokens with a cryptographically secure RNG;
- store only session-token hashes;
- rotate or recreate sessions after login;
- use `HttpOnly`, `SameSite=Lax`, path-scoped cookies and `Secure` in production;
- implement expiration, logout revocation, and global user-session revocation;
- reject disabled users on every authenticated request;
- rate-limit login and invitation-validation/registration endpoints.

### CSRF, origin, and headers

- use same-origin deployment topology;
- enforce trusted-origin checks for unsafe methods;
- add CSRF defense for browser state changes;
- add appropriate security headers and a realistic content-security policy;
- never use wildcard credentialed CORS;
- document development and production origins.

### Authorization

- enforce authentication and authorization in NestJS guards/policies and service-level checks where object ownership matters;
- cover permission decisions with unit tests and endpoint denial tests;
- prevent IDOR by checking course membership/visibility for every object lookup;
- do not expose whether inaccessible private objects exist when a generic not-found response is safer.

### Uploads and rendering

- enforce size, quota, extension, and detected MIME/signature checks on the server;
- stream to storage while calculating SHA-256;
- use private S3/MinIO objects and random keys;
- use short-lived presigned download URLs after authorization;
- sanitize Markdown and rendered notebook content;
- escape source/text previews;
- restrict Mermaid and external links;
- never invoke a shell, compiler, interpreter, office macro engine, notebook kernel, or archive extraction on user content.

### Secrets and logs

- commit only `.env.example`;
- redact credentials, tokens, invitation codes, and signed URLs;
- use structured logs with request correlation IDs;
- return safe API errors;
- add audit records for sensitive admin operations;
- ensure local development secrets are explicitly marked as non-production.

---

## 6. Milestone execution plan

Codex must progress in order unless a dependency requires a small reordering. Update `docs/progress.md` after each milestone.

### Milestone 0 — Inspect, decide, and scaffold

Deliver:

- initialized Git repository if absent;
- pnpm workspace and Turborepo;
- `apps/web`, `apps/api`, shared packages, Prisma directory, docs, scripts, and CI skeleton;
- root commands required by `AGENTS.md`;
- strict TypeScript, ESLint, Prettier, editor settings, and `.gitignore`;
- `.env.example` with validated variables and explanations;
- initial `README.md`;
- architecture decision notes in `docs/architecture.md`.

Verify:

- install succeeds;
- lint/typecheck on scaffold succeeds;
- both apps can start with minimal health/home surfaces.

Do not spend time on visual polish here.

### Milestone 1 — Infrastructure, schema, and seed

Deliver:

- Docker Compose PostgreSQL and MinIO;
- health checks;
- bucket initialization;
- Prisma schema for all required domain entities;
- first migration;
- deterministic development seed;
- database and storage health endpoints;
- seed credential strategy documented without committing a real password.

Verify:

- clean infrastructure startup;
- clean migration;
- seed rerun behavior;
- API can access PostgreSQL and private MinIO;
- direct unauthenticated object access fails.

### Milestone 2 — Authentication and global authorization

Deliver:

- invitation-based registration foundation;
- login/logout/current-user endpoints;
- Argon2id password hashing;
- opaque session cookies and session table;
- CSRF/origin checks;
- rate limiting;
- user disabling and session revocation;
- authentication UI and route protection;
- reusable authorization policy layer;
- tests for session and role rules.

Verify:

- valid invited user can register and log in;
- invalid/expired/revoked/exhausted invitation is rejected;
- session cookie is not readable by JavaScript;
- logout and disabling invalidate access;
- anonymous protected calls fail;
- security tests pass.

### Milestone 3 — Semesters, courses, memberships, and invitations

Deliver:

- semester and course management;
- course membership model and UI;
- course-admin scope;
- invitation creation with course, role, expiry, usage limit, and revocation;
- hashed invitation storage;
- dashboard and course pages;
- permission matrix documentation.

Verify:

- each role receives only intended access;
- course admin cannot administer another course;
- read-only member cannot mutate course content;
- system admin can manage all courses;
- invitations respect expiry, revocation, and usage counts.

### Milestone 4 — Resource upload, versioning, and download

Deliver:

- resource metadata CRUD;
- category and tag support;
- streamed upload to MinIO;
- MIME/extension/size/quota validation;
- SHA-256 calculation;
- exact duplicate handling;
- immutable resource versions;
- authorized, expiring download URL;
- download record/count;
- soft delete/restore;
- upload and resource-detail UI.

Verify with integration and E2E tests:

- authorized upload succeeds;
- forbidden type and oversized file fail safely;
- quota is enforced;
- duplicate detection works;
- a new version preserves the old object;
- unauthorized user cannot download;
- object bucket remains private;
- signed URL expires as configured or is generated with the configured short TTL.

### Milestone 5 — Search, browsing, and previews

Deliver:

- materials index;
- metadata query across title, description, course, category, tags, uploader, and original filename;
- filters, sorting, and pagination;
- PDF preview;
- sanitized Markdown preview;
- image preview;
- escaped text/code preview with syntax highlighting;
- supported/unsupported preview states;
- responsive navigation and useful loading/empty/error states.

Verify:

- search combinations return correct scoped results;
- users never receive resources outside their visibility;
- malicious Markdown fixtures do not execute script;
- large text preview limits are enforced;
- preview requests require authorization.

### Milestone 6 — Notes, revisions, favorites, and profile

Deliver:

- note list/detail/editor;
- autosaved draft;
- publish/update;
- visibility policies;
- GFM, code highlighting, math, safe Mermaid, and table of contents;
- revision creation, history, comparison summary if practical, and restore;
- resource and note favorites;
- personal dashboard/profile showing own uploads, notes, favorites, and quota usage.

Verify:

- draft and publish paths work;
- unauthorized edits fail;
- restore creates or preserves an auditable revision chain;
- sanitized output blocks unsafe HTML/URLs;
- favorites are unique per user/item;
- E2E note workflow passes.

### Milestone 7 — Administrative UI and auditing

Deliver:

- user administration and status controls;
- course, membership, and invitation administration;
- resource moderation, soft delete, restore, and duplicate inspection;
- audit-log view with filters;
- confirmation for destructive actions;
- strict admin route/API guards.

Verify:

- ordinary members cannot invoke admin endpoints even by direct requests;
- audit entries are created for required operations;
- sensitive values do not appear in audit payloads or logs;
- disabling a user revokes sessions;
- admin E2E path passes.

### Milestone 8 — Reliability, CI, backup, and deployment

Deliver:

- complete unit, integration, and E2E suites;
- GitHub Actions for install, format, lint, typecheck, tests, and build;
- production Dockerfiles or equivalent reproducible images;
- production reverse-proxy/same-origin guidance;
- health/readiness endpoints;
- structured logging and graceful shutdown;
- database backup and restore scripts/documentation;
- MinIO/S3 backup guidance;
- operator documentation;
- dependency and container review.

Verify:

- `pnpm verify` passes;
- E2E command passes;
- production builds pass;
- migration works against an empty database;
- backup and restore procedure is exercised on local sample data;
- restored data includes users, course metadata, notes, and resource object references/content according to the documented procedure.

### Milestone 9 — Final review and handoff

Perform:

- full diff and architecture review;
- authorization/IDOR review;
- upload and rendering threat review;
- accessibility smoke review;
- removal of dead code, debug routes, temporary bypasses, placeholder data, and unexplained TODOs;
- README setup rehearsal from a clean state;
- final `docs/progress.md` completion report;
- explicit list of deferred P1/P2 enhancements.

Use Playwright to inspect primary screens at desktop and mobile viewport sizes. Fix severe usability defects, broken layouts, missing labels, and inaccessible navigation. Do not expand scope into a public community or AI platform.

---

## 7. Required seed scenario

Provide a documented development seed that allows repeatable tests and manual review. Use environment-provided passwords and print safe setup guidance without logging secrets after initial setup.

Seed at least:

- one system administrator;
- one ordinary member;
- one read-only member;
- one course administrator;
- one active semester;
- two courses;
- memberships demonstrating each role;
- resource categories;
- sample tags;
- at least one invitation for testing with safe development-only handling;
- representative PDF/Markdown/text/code metadata or generated harmless fixtures;
- at least one published note and one draft.

Do not add copyrighted textbooks, real university exam papers, personal information, or third-party course materials to the repository.

---

## 8. User-facing acceptance scenarios

The final E2E suite and manual smoke checklist must cover these stories.

### Scenario A — New invited member

1. Open registration with an invitation code.
2. Create an account.
3. Log in.
4. See the invited course on the dashboard.
5. Open the course and browse available materials.
6. Log out and lose protected access.

### Scenario B — Member contributes a file

1. Log in as a normal member.
2. Select a course and category.
3. Upload a safe Markdown, PDF, image, text, or code fixture.
4. See upload progress and a useful success state.
5. Open the resource detail.
6. Preview the supported file.
7. Download through an authorized short-lived URL.
8. Upload a revised file and see version history.

### Scenario C — Read-only restriction

1. Log in as a read-only member.
2. Browse and download an authorized resource.
3. Attempt upload, note publication, resource edit, and direct API mutation.
4. Confirm all mutations are denied server-side.

### Scenario D — Notes

1. Create a course note with headings, code, math, and Mermaid.
2. Observe draft autosave.
3. Publish the note.
4. Edit and create a revision.
5. Restore an earlier revision.
6. Confirm unsafe embedded HTML/scripts do not execute.

### Scenario E — Course administrator

1. Create a course invitation with an expiry and usage limit.
2. Add/change a member role in the authorized course.
3. Moderate a course resource.
4. Fail to administer an unrelated course.
5. See appropriate audit records.

### Scenario F — System administrator

1. Search users.
2. Disable a user and revoke sessions.
3. Restore the user.
4. Manage a semester/course.
5. Inspect invitations, resources, duplicates, and audit entries.
6. Confirm all destructive actions require confirmation.

---

## 9. Quality constraints

- maintain strict TypeScript and avoid `any`;
- keep API controllers thin;
- centralize authorization and environment validation;
- use transactions for invitation consumption, quota-sensitive uploads, and multi-record admin operations;
- avoid N+1 database queries on main listing pages;
- add indexes informed by real query paths;
- do not introduce Redis unless a measured requirement appears;
- do not introduce a second backend language;
- do not split into microservices;
- do not use mock data in production paths;
- do not skip tests to make CI green;
- do not weaken Content Security Policy, CORS, CSRF, cookie, or storage privacy merely to simplify development;
- use generated harmless test fixtures rather than copyrighted or personal files;
- keep documentation synchronized with actual commands and behavior.

---

## 10. Progress reporting

Maintain `docs/progress.md` with this structure:

```markdown
# Progress

## Current milestone
- milestone:
- status:
- last verified commit/state:

## Completed
- item
- verification command and result

## In progress
- item
- next concrete action

## Decisions and assumptions
- decision
- reason

## Blockers
- exact command
- concise error
- attempted fixes
- minimum input required

## Deferred non-MVP work
- item
```

After every milestone, include:

- files/modules delivered;
- database migrations added;
- tests added;
- exact commands run;
- whether each command passed;
- known limitations.

Keep updates concise and evidence-based.

---

## 11. Blocked stop condition

Do not stop at the first dependency error or failing test. Diagnose and attempt reasonable fixes that remain within the repository and allowed local tools.

Stop and report a blocker only when:

- required credentials, permissions, or an unavailable external service are indispensable;
- the environment cannot provide a required runtime and no local fallback is possible;
- requirements are mutually contradictory;
- continuing would require weakening a mandatory security constraint;
- repeated evidence shows no valid path remains under the current limits.

A blocker report must contain:

1. the exact unmet acceptance criterion;
2. the exact command or action that fails;
3. relevant concise output;
4. changes already attempted;
5. the current repository state;
6. the smallest user decision or input that would unlock progress.

Never claim completion with a hidden blocker.

---

## 12. Final completion report

When all acceptance criteria pass, conclude with a report containing:

- concise architecture summary;
- implemented feature checklist;
- security controls implemented;
- commands and test results;
- local startup steps;
- seed-account setup method;
- production deployment outline;
- backup/restore outline;
- known limitations;
- prioritized next steps, clearly separated from the completed MVP.

The Goal is complete only when the repository is demonstrably usable from a fresh setup and the evidence in Section 2 is satisfied.
