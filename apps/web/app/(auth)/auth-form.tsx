"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type AuthField = {
  id: string;
  label: string;
  type: string;
  autoComplete?: string;
};

type AuthFormProps = {
  title: string;
  description: string;
  submitLabel: string;
  endpoint: "/api/auth/login" | "/api/auth/register";
  fields: AuthField[];
};

type ApiError = {
  message?: string;
};

export function AuthForm(props: AuthFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string>("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "include"
      });
      const csrfData = (await csrfResponse.json()) as { csrfToken: string };
      const response = await fetch(props.endpoint, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfData.csrfToken
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as ApiError;
        setMessage(error.message ?? "Authentication failed.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-950">{props.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{props.description}</p>
        <form
          className="mt-8 space-y-5"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          {props.fields.map((field) => (
            <div key={field.id} className="space-y-2">
              <label className="text-sm font-medium text-slate-800" htmlFor={field.id}>
                {field.label}
              </label>
              <input
                className="min-h-10 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100"
                id={field.id}
                name={field.id}
                type={field.type}
                autoComplete={field.autoComplete ?? "on"}
                required
              />
            </div>
          ))}
          {message ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {message}
            </p>
          ) : null}
          <button
            className="min-h-10 w-full rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? "Please wait" : props.submitLabel}
          </button>
        </form>
      </section>
    </main>
  );
}
