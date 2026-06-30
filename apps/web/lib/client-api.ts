"use client";

type JsonRecord = Record<string, unknown>;

export async function csrfJson<T = JsonRecord>(
  path: string,
  init: RequestInit & { body?: BodyInit | null } = {}
): Promise<T> {
  const response = await csrfRequest(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });
  return (await response.json()) as T;
}

export async function csrfRequest(
  path: string,
  init: RequestInit & { body?: BodyInit | null } = {}
): Promise<Response> {
  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "include"
  });
  if (!csrfResponse.ok) {
    throw new Error("Unable to start a secure request.");
  }
  const csrfBody = (await csrfResponse.json()) as { csrfToken?: unknown };
  if (typeof csrfBody.csrfToken !== "string") {
    throw new Error("The server did not return a CSRF token.");
  }

  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "x-csrf-token": csrfBody.csrfToken,
      ...(init.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(await safeErrorMessage(response));
  }
  return response;
}

async function safeErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string") return body.message;
  } catch {
    // Fall through to a generic safe message.
  }
  return `Request failed with status ${response.status}.`;
}
