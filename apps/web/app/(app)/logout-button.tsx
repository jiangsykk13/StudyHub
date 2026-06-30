"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include" });
      const csrfData = (await csrfResponse.json()) as { csrfToken: string };
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "x-csrf-token": csrfData.csrfToken
        }
      });
      router.push("/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
      disabled={pending}
      onClick={() => {
        void logout();
      }}
      type="button"
    >
      {pending ? "Signing out" : "Log out"}
    </button>
  );
}
