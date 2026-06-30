"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AdminUserSummary } from "../../../../lib/api";
import { csrfJson } from "../../../../lib/client-api";

export function AdminUsersClient(props: { users: AdminUserSummary[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function runAction(userId: string, action: "disable" | "enable" | "revoke-sessions") {
    if (action === "disable" && !window.confirm("Disable this user and revoke active sessions?")) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        await csrfJson(`/api/admin/users/${userId}/${action}`, {
          method: "POST",
          body: "{}"
        });
        setMessage(
          action === "disable"
            ? "User disabled."
            : action === "enable"
              ? "User enabled."
              : "Sessions revoked."
        );
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "User update failed.");
      }
    });
  }

  return (
    <section className="space-y-4 rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-950">Users</h2>
      {message ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          {message}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-md border border-slate-200">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-normal text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Activity</th>
              <th className="px-4 py-3 font-semibold">Memberships</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {props.users.map((user) => (
              <tr key={user.id} className="border-t border-slate-200 align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-950">{user.displayName}</div>
                  <div className="mt-1 text-slate-600">{user.email}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {user.role === "SYSTEM_ADMIN" ? "System admin" : "Member"}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {user.disabledAt
                    ? `Disabled ${new Date(user.disabledAt).toLocaleDateString()}`
                    : "Active"}
                  <div className="mt-1 text-xs text-slate-500">
                    {user.activeSessionCount} active sessions
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {user.uploadCount} uploads
                  <div className="mt-1">{user.noteCount} notes</div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {user.memberships.length === 0 ? (
                    "None"
                  ) : (
                    <div className="space-y-1">
                      {user.memberships.slice(0, 3).map((membership) => (
                        <div key={membership.courseId}>
                          {membership.courseCode} · {roleLabel(membership.role)}
                        </div>
                      ))}
                      {user.memberships.length > 3 ? (
                        <div className="text-xs text-slate-500">
                          +{user.memberships.length - 3} more
                        </div>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    {user.disabledAt ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => runAction(user.id, "enable")}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-60"
                      >
                        Enable
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={pending || user.role === "SYSTEM_ADMIN"}
                        onClick={() => runAction(user.id, "disable")}
                        className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
                      >
                        Disable
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => runAction(user.id, "revoke-sessions")}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-60"
                    >
                      Revoke Sessions
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function roleLabel(role: AdminUserSummary["memberships"][number]["role"]): string {
  if (role === "COURSE_ADMIN") return "Course admin";
  if (role === "READ_ONLY") return "Read-only";
  return "Member";
}
