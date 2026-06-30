"use client";

import { useState, useTransition } from "react";
import { csrfJson } from "../../../../lib/client-api";
import type { CourseSummary, InvitationSummary } from "../../../../lib/api";

type AdminInvitationsClientProps = {
  courses: CourseSummary[];
  invitations: InvitationSummary[];
};

type Role = "COURSE_ADMIN" | "MEMBER" | "READ_ONLY";

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: "MEMBER", label: "Member" },
  { value: "READ_ONLY", label: "Read-only" },
  { value: "COURSE_ADMIN", label: "Course admin" }
];

export function AdminInvitationsClient(props: AdminInvitationsClientProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [oneTimeCode, setOneTimeCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function createInvitation(formData: FormData) {
    setMessage(null);
    setOneTimeCode(null);
    startTransition(async () => {
      try {
        const courseId = optionalString(formData, "courseId");
        const response = await csrfJson<{ code: string }>("/api/invitations", {
          method: "POST",
          body: JSON.stringify({
            ...(courseId ? { courseId } : {}),
            membershipRole: requiredString(formData, "membershipRole"),
            expiresAt: localDateTimeToIso(requiredString(formData, "expiresAt")),
            usageLimit: Number(requiredString(formData, "usageLimit"))
          })
        });
        setOneTimeCode(response.code);
        setMessage("Invitation created. Copy the one-time code before leaving this page.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Invitation creation failed.");
      }
    });
  }

  function revokeInvitation(invitationId: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        await csrfJson(`/api/invitations/${invitationId}/revoke`, {
          method: "POST",
          body: "{}"
        });
        setMessage("Invitation revoked.");
        window.location.reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Invitation revocation failed.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          {message}
        </div>
      ) : null}
      {oneTimeCode ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-normal text-amber-900">
            One-time invitation code
          </div>
          <code className="mt-2 block break-all text-sm text-amber-950">{oneTimeCode}</code>
        </div>
      ) : null}

      <form
        action={createInvitation}
        className="grid gap-3 rounded-md border border-slate-200 bg-white p-5 lg:grid-cols-5"
      >
        <label className="text-sm font-medium text-slate-700">
          Scope
          <select
            name="courseId"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">All-site</option>
            {props.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} · {course.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Role
          <select
            name="membershipRole"
            defaultValue="MEMBER"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          >
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Expiry
          <input
            name="expiresAt"
            type="datetime-local"
            defaultValue={defaultExpiry()}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Usage limit
          <input
            name="usageLimit"
            type="number"
            min="1"
            max="1000"
            defaultValue="1"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="self-end rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Create Invitation
        </button>
      </form>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Invitations</h2>
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-normal text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Scope</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Usage</th>
                <th className="px-4 py-3 font-semibold">Expiry</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {props.invitations.map((invitation) => (
                <tr key={invitation.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-700">
                    {invitation.course
                      ? `${invitation.course.code} · ${invitation.course.title}`
                      : "All-site"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {roleLabel(invitation.membershipRole)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {invitation.usedCount}/{invitation.usageLimit}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {new Date(invitation.expiresAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {invitation.revokedAt ? "Revoked" : "Active"}
                  </td>
                  <td className="px-4 py-3">
                    {!invitation.revokedAt ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => revokeInvitation(invitation.id)}
                        className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
                      >
                        Revoke
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function optionalString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function localDateTimeToIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("A valid expiry date is required.");
  }
  return date.toISOString();
}

function defaultExpiry(): string {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

function roleLabel(role: Role): string {
  if (role === "COURSE_ADMIN") return "Course admin";
  if (role === "READ_ONLY") return "Read-only";
  return "Member";
}
