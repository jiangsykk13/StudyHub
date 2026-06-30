# Permissions

The API enforces all permission rules. The UI may hide controls for usability, but server-side checks remain authoritative.

## Roles

- `SYSTEM_ADMIN`: global administrator.
- `COURSE_ADMIN`: course-scoped membership administrator.
- `MEMBER`: active course participant who can contribute content.
- `READ_ONLY`: course participant who can browse and download but cannot mutate course content.

## Matrix

| Action                            | Anonymous | Read-only   | Member           | Course admin       | System admin |
| --------------------------------- | --------- | ----------- | ---------------- | ------------------ | ------------ |
| Register with valid invitation    | Yes       | Yes         | Yes              | Yes                | Yes          |
| Login/logout                      | Yes       | Yes         | Yes              | Yes                | Yes          |
| View own profile                  | No        | Yes         | Yes              | Yes                | Yes          |
| View authorized course            | No        | Yes         | Yes              | Yes                | Yes          |
| Download authorized material      | No        | Yes         | Yes              | Yes                | Yes          |
| Upload course material            | No        | No          | Own courses      | Own courses        | Any course   |
| Create shared course note         | No        | No          | Own courses      | Own courses        | Any course   |
| Edit own resource/note            | No        | No          | Own content only | Own course content | Any content  |
| View published course note        | No        | Own courses | Own courses      | Own courses        | Any course   |
| View all-member published note    | No        | Yes         | Yes              | Yes                | Yes          |
| Favorite visible resource/note    | No        | Yes         | Yes              | Yes                | Yes          |
| Manage course members             | No        | No          | No               | Own courses        | Any course   |
| Create course invitation          | No        | No          | No               | Own courses        | Any course   |
| Manage semesters/courses globally | No        | No          | No               | No                 | Yes          |
| Create all-site invitation        | No        | No          | No               | No                 | Yes          |
| Revoke invitation                 | No        | No          | No               | Own courses        | Any course   |
| Disable users/revoke sessions     | No        | No          | No               | No                 | Yes          |
| View audit logs                   | No        | No          | No               | Own course events  | All events   |
| Moderate resources                | No        | No          | No               | Own courses        | Any course   |

Private objects should return a generic not-found response when revealing their existence would leak information.

## Current Enforcement Notes

- Semester creation, updates, and archival are system-admin-only.
- Course creation, updates, and archival are system-admin-only.
- Course administrators can update member roles and create or revoke invitations only for courses where their `CourseMember.role` is `COURSE_ADMIN`.
- Invitation codes are returned only once on creation; persisted invitation records store only `codeHash`, and list/revoke responses omit both the code and hash.
- Registration consumes invitation usage inside the same database transaction that creates the user and course membership.
- Resource uploads require `MEMBER`, `COURSE_ADMIN`, or `SYSTEM_ADMIN` write access to the target course; `READ_ONLY` members are rejected server-side.
- Resource downloads require authenticated visibility: course membership for `COURSE_MEMBERS`, any authenticated active user for `ALL_MEMBERS`, and uploader/course-admin/system-admin access for `PRIVATE`.
- Resource metadata updates, new versions, soft delete, and restore require owner write access, course-admin access, or system-admin access.
- Resource downloads return short-lived presigned URLs after authorization and create `DownloadRecord` rows; permanent object URLs remain private.
- Resource previews use the same visibility rules as resource detail and download; unsupported files return a safe download-only preview state instead of pretending to render.
- Note creation requires course contribution rights; `READ_ONLY` members are rejected server-side.
- Note drafts are private to authorized mutators. Users who can view a published note but cannot edit it receive `draftContent: null`.
- Note publication creates immutable `NoteRevision` snapshots. Revision restore creates a new revision and an audit entry instead of erasing history.
- Note visibility is enforced as follows: `PRIVATE` is visible to the author and course/system administrators; `COURSE_MEMBERS` requires active course membership unless the user can administer or authored the note; `ALL_MEMBERS` is visible to any authenticated active user after publication.
- Note editing, soft deletion, deleted-note restore, and revision restore require author write access, course-admin access, or system-admin access.
- Favorites can be created only for currently visible resources or notes, are scoped to the signed-in user, and are unique per user/item.
- Profile summary data is scoped to the signed-in user and does not expose other users' drafts, favorites, or quota usage.
- Admin user search/status/session controls are system-admin-only.
- Admin resource moderation is allowed to system administrators globally and course administrators only inside their administered courses.
- Audit log listing is global for system administrators and course-scoped for course administrators; non-admin members are rejected.
- Resource moderation uses soft deletion/restoration and creates audit records. Storage objects are not destructively removed by admin moderation.
