"use client";

import { useState, useTransition } from "react";
import { csrfJson } from "../../../../lib/client-api";

type Role = "COURSE_ADMIN" | "MEMBER" | "READ_ONLY";

type CourseAdminPanelProps = {
  courseId: string;
  members: Array<{
    userId: string;
    email: string;
    displayName: string;
    role: Role;
    disabledAt: string | null;
  }>;
  invitations: Array<{
    id: string;
    membershipRole: Role;
    expiresAt: string;
    usageLimit: number;
    usedCount: number;
    revokedAt: string | null;
  }>;
};

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: "MEMBER", label: "Member" },
  { value: "READ_ONLY", label: "Read-only" },
  { value: "COURSE_ADMIN", label: "Course admin" }
];

export function CourseAdminPanel(props: CourseAdminPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [oneTimeCode, setOneTimeCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function createInvitation(formData: FormData) {
    setMessage(null);
    setOneTimeCode(null);
    startTransition(async () => {
      try {
        const response = await csrfJson<{ code: string }>("/api/invitations", {
          method: "POST",
          body: JSON.stringify({
            courseId: props.courseId,
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

  function updateMemberRole(userId: string, formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await csrfJson(`/api/courses/${props.courseId}/members/${userId}`, {
          method: "PATCH",
          body: JSON.stringify({ role: requiredString(formData, "role") })
        });
        setMessage("Member role updated.");
        window.location.reload();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Member role update failed.");
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
    <section className="space-y-5 rounded-md border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Course Administration</h2>
        <p className="mt-1 text-sm text-slate-600">
          Manage course-scoped members and invitation codes for this course.
        </p>
      </div>

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

      <form action={createInvitation} className="grid gap-3 md:grid-cols-4">
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

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-normal text-slate-600">
            Members
          </h3>
          <div className="space-y-2">
            {props.members.map((member) => (
              <form
                key={member.userId}
                action={(formData) => updateMemberRole(member.userId, formData)}
                className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[1fr_160px_auto]"
              >
                <div>
                  <div className="font-medium text-slate-950">{member.displayName}</div>
                  <div className="text-sm text-slate-600">{member.email}</div>
                  {member.disabledAt ? (
                    <div className="mt-1 text-xs text-red-700">Disabled account</div>
                  ) : null}
                </div>
                <select
                  name="role"
                  defaultValue={member.role}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-60"
                >
                  Save
                </button>
              </form>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-normal text-slate-600">
            Invitations
          </h3>
          <div className="space-y-2">
            {props.invitations.length === 0 ? (
              <p className="rounded-md border border-slate-200 p-3 text-sm text-slate-600">
                No course invitations have been created yet.
              </p>
            ) : (
              props.invitations.map((invitation) => (
                <div key={invitation.id} className="rounded-md border border-slate-200 p-3">
                  <div className="font-medium text-slate-950">
                    {roleLabel(invitation.membershipRole)} · {invitation.usedCount}/
                    {invitation.usageLimit} used
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Expires {new Date(invitation.expiresAt).toLocaleString()}
                    {invitation.revokedAt ? " · revoked" : ""}
                  </div>
                  {!invitation.revokedAt ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => revokeInvitation(invitation.id)}
                      className="mt-3 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
                    >
                      Revoke
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} is required.`);
  }
  return value;
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
