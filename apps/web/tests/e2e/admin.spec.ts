import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@example.test";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe-Admin-DevOnly-12345";
const disposablePassword = "ChangeMe-E2E-Admin-12345";

test("system administrator disables, restores, and revokes sessions for a disposable user", async ({
  page
}) => {
  const suffix = Date.now();
  const invitedEmail = `admin-e2e-${suffix}@example.test`;
  const invitedName = `Admin E2E ${suffix}`;

  await login(page, adminEmail, adminPassword);
  const invitationCode = await createMemberInvitation(page);

  await page.context().clearCookies();
  await page.goto("/register");
  await page.getByLabel("Invitation code").fill(invitationCode);
  await page.getByLabel("Display name").fill(invitedName);
  await page.getByLabel("Email").fill(invitedEmail);
  await page.getByLabel("Password").fill(disposablePassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: /Welcome,/ })).toBeVisible();

  await page.goto("/admin/users");
  await expect(page.getByText("System administrator access is required")).toBeVisible();

  await login(page, adminEmail, adminPassword, { clearCookies: true });
  await page.goto(`/admin/users?q=${encodeURIComponent(invitedEmail)}`);
  const userRow = page.getByRole("row", { name: new RegExp(escapeRegex(invitedEmail)) });
  await expect(userRow).toBeVisible();

  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await userRow.getByRole("button", { name: "Disable" }).click();
  await expect(page.getByText("User disabled.")).toBeVisible();
  await expect(userRow).toContainText("Disabled");

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(invitedEmail);
  await page.getByLabel("Password").fill(disposablePassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();

  await login(page, adminEmail, adminPassword);
  await page.goto(`/admin/users?q=${encodeURIComponent(invitedEmail)}`);
  const disabledRow = page.getByRole("row", { name: new RegExp(escapeRegex(invitedEmail)) });
  await disabledRow.getByRole("button", { name: "Enable" }).click();
  await expect(page.getByText("User enabled.")).toBeVisible();

  await login(page, invitedEmail, disposablePassword, { clearCookies: true });
  const restoredUserCookies = await page.context().cookies();

  await login(page, adminEmail, adminPassword, { clearCookies: true });
  await page.goto(`/admin/users?q=${encodeURIComponent(invitedEmail)}`);
  const enabledRow = page.getByRole("row", { name: new RegExp(escapeRegex(invitedEmail)) });
  await enabledRow.getByRole("button", { name: "Revoke Sessions" }).click();
  await expect(page.getByText("Sessions revoked.")).toBeVisible();

  await page.goto("/admin/audit?action=USER_DISABLED");
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "USER_DISABLED" }).first()).toBeVisible();

  await page.context().clearCookies();
  await page.context().addCookies(restoredUserCookies);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

async function login(
  page: Page,
  email: string,
  password: string,
  options: { clearCookies?: boolean } = {}
): Promise<void> {
  if (options.clearCookies) {
    await page.context().clearCookies();
  }
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: /Welcome,/ })).toBeVisible();
}

async function createMemberInvitation(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include" });
    if (!csrfResponse.ok) {
      throw new Error(`CSRF request failed with ${csrfResponse.status}`);
    }
    const csrfBody = (await csrfResponse.json()) as { csrfToken?: unknown };
    if (typeof csrfBody.csrfToken !== "string") {
      throw new Error("CSRF token was missing.");
    }

    const courseResponse = await fetch("/api/courses", { credentials: "include" });
    if (!courseResponse.ok) {
      throw new Error(`Course request failed with ${courseResponse.status}`);
    }
    const courseBody = (await courseResponse.json()) as {
      courses?: Array<{ id?: unknown }>;
    };
    const courseId = courseBody.courses?.find((course) => typeof course.id === "string")?.id;
    if (typeof courseId !== "string") {
      throw new Error("No administrable course was available for the E2E invitation.");
    }

    const invitationResponse = await fetch("/api/invitations", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfBody.csrfToken
      },
      body: JSON.stringify({
        courseId,
        membershipRole: "MEMBER",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        usageLimit: 1
      })
    });
    if (!invitationResponse.ok) {
      throw new Error(`Invitation request failed with ${invitationResponse.status}`);
    }
    const invitationBody = (await invitationResponse.json()) as { code?: unknown };
    if (typeof invitationBody.code !== "string") {
      throw new Error("Invitation code was not returned.");
    }
    return invitationBody.code;
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
