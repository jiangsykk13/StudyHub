import {
  apiGet,
  type AuthMe,
  type CourseSummary,
  type InvitationSummary
} from "../../../../lib/api";
import { PageHeader } from "../../shared";
import { AdminInvitationsClient } from "./admin-invitations-client";

export const dynamic = "force-dynamic";

export default async function AdminInvitationsPage() {
  const me = await apiGet<AuthMe>("/api/auth/me");
  if (me.user.role !== "SYSTEM_ADMIN") {
    return (
      <PageHeader
        title="Invitation administration"
        description="System administrator access is required for global invitation management."
      />
    );
  }

  const [courseResult, invitationResult] = await Promise.all([
    apiGet<{ courses: CourseSummary[] }>("/api/courses"),
    apiGet<{ invitations: InvitationSummary[] }>("/api/invitations")
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invitation administration"
        description="Create, list, and revoke hashed invitation records. Raw codes are shown only once."
      />
      <AdminInvitationsClient
        courses={courseResult.courses}
        invitations={invitationResult.invitations}
      />
    </div>
  );
}
