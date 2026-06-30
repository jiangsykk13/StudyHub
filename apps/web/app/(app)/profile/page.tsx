import { apiGet, type AuthMe, type CourseSummary, type ProfileSummary } from "../../../lib/api";
import { PageHeader } from "../shared";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [me, courseResult, profileResult] = await Promise.all([
    apiGet<AuthMe>("/api/auth/me"),
    apiGet<{ courses: CourseSummary[] }>("/api/courses"),
    apiGet<{ profile: ProfileSummary }>("/api/profile/summary")
  ]);
  const profile = profileResult.profile;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Account details, contribution activity, favorites, and storage quota."
      />
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <dl className="grid gap-4 md:grid-cols-3">
          <div>
            <dt className="text-sm text-slate-600">Name</dt>
            <dd className="mt-1 font-medium text-slate-950">{me.user.displayName}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">Email</dt>
            <dd className="mt-1 font-medium text-slate-950">{me.user.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">Global role</dt>
            <dd className="mt-1 font-medium text-slate-950">
              {me.user.role === "SYSTEM_ADMIN" ? "System administrator" : "Member"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-4 md:grid-cols-4" aria-label="Personal summary">
        <Metric label="Own uploads" value={profile.uploads.count.toString()} />
        <Metric label="Own notes" value={profile.notes.count.toString()} />
        <Metric label="Favorites" value={profile.favorites.count.toString()} />
        <Metric
          label="Quota used"
          value={`${formatBytes(profile.quota.usedBytes)} / ${formatBytes(profile.quota.limitBytes)}`}
        />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Course Memberships</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {courseResult.courses.map((course) => (
            <div key={course.id} className="rounded-md border border-slate-200 p-4">
              <div className="font-medium text-slate-950">
                {course.code} · {course.title}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {course.semester.name} · {course.canAdmin ? "Course admin" : course.membershipRole}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Recent Uploads</h2>
          {profile.uploads.recent.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No uploads yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {profile.uploads.recent.map((resource) => (
                <div key={resource.id} className="rounded-md border border-slate-200 p-3">
                  <div className="font-medium text-slate-950">{resource.title}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {resource.course.code} · {new Date(resource.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">Recent Notes</h2>
          {profile.notes.recent.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No authored notes yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {profile.notes.recent.map((note) => (
                <div key={note.id} className="rounded-md border border-slate-200 p-3">
                  <div className="font-medium text-slate-950">{note.title}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {note.course.code} · {note.publishedAt ? "Published" : "Draft"} ·{" "}
                    {new Date(note.updatedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-600">{props.label}</div>
      <div className="mt-2 text-base font-semibold text-slate-950">{props.value}</div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
