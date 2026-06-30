import Link from "next/link";
import { apiGet, type AuthMe, type CourseSummary, type ProfileSummary } from "../../../lib/api";
import { PageHeader } from "../shared";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [me, courseResult, profileResult] = await Promise.all([
    apiGet<AuthMe>("/api/auth/me"),
    apiGet<{ courses: CourseSummary[] }>("/api/courses"),
    apiGet<{ profile: ProfileSummary }>("/api/profile/summary")
  ]);
  const writableCount = courseResult.courses.filter((course) => course.canContribute).length;
  const profile = profileResult.profile;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${me.user.displayName}`}
        description="Your authorized course spaces and contribution access are shown from the private API session."
      />

      <section className="grid gap-4 md:grid-cols-3" aria-label="Account summary">
        <Metric label="Authorized courses" value={courseResult.courses.length.toString()} />
        <Metric label="Courses you can contribute to" value={writableCount.toString()} />
        <Metric label="Global role" value={me.user.role === "SYSTEM_ADMIN" ? "Admin" : "Member"} />
      </section>

      <section className="grid gap-4 md:grid-cols-4" aria-label="Personal activity summary">
        <Metric label="Own uploads" value={profile.uploads.count.toString()} />
        <Metric label="Own notes" value={profile.notes.count.toString()} />
        <Metric label="Favorites" value={profile.favorites.count.toString()} />
        <Metric label="Quota used" value={`${profile.quota.percentUsed}%`} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">My Courses</h2>
        {courseResult.courses.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No active course memberships are available yet.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {courseResult.courses.map((course) => (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="rounded-md border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300"
              >
                <div className="text-xs font-medium uppercase tracking-normal text-slate-500">
                  {course.semester.name}
                </div>
                <div className="mt-1 text-base font-semibold text-slate-950">
                  {course.code} · {course.title}
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {course.memberCount} members · {roleLabel(course.membershipRole, course.canAdmin)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-600">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{props.value}</div>
    </div>
  );
}

function roleLabel(role: CourseSummary["membershipRole"], canAdmin: boolean): string {
  if (canAdmin) return "Course admin";
  if (role === "READ_ONLY") return "Read-only";
  if (role === "MEMBER") return "Member";
  return "System administrator";
}
