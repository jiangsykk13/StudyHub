import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const memberEmail = process.env.E2E_MEMBER_EMAIL ?? "member@example.test";
const memberPassword = process.env.E2E_MEMBER_PASSWORD ?? "ChangeMe-Member-DevOnly-12345";
const readonlyEmail = process.env.E2E_READONLY_EMAIL ?? "readonly@example.test";
const readonlyPassword = process.env.E2E_READONLY_PASSWORD ?? "ChangeMe-Readonly-DevOnly-12345";

test("member uploads, previews, downloads, versions, searches, and logs out", async ({ page }) => {
  const suffix = Date.now();
  const title = `E2E material ${suffix}`;
  const firstFilename = `e2e-material-${suffix}.md`;
  const secondFilename = `e2e-material-${suffix}-v2.md`;

  await login(page, memberEmail, memberPassword);
  await page.goto("/materials/upload");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("Playwright upload acceptance fixture.");
  await page.getByLabel("Tags").fill(`e2e-${suffix}, upload`);
  await page.getByLabel("File").setInputFiles({
    name: firstFilename,
    mimeType: "text/markdown",
    buffer: Buffer.from(`# ${title}\n\nInitial preview body.`)
  });

  const createResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/resources") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Upload Material" }).click();
  const created = await createResponse;
  expect(created.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/materials\/[0-9a-f-]+$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: title, level: 1 }).first()).toBeVisible();
  await expect(page.getByText("Initial preview body.")).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: firstFilename })).toBeVisible();

  const resourceUrl = page.url();
  const downloadResponse = page.waitForResponse(
    (response) => response.url().includes("/api/resources/") && response.url().endsWith("/download")
  );
  await page.getByRole("button", { name: "Download" }).click();
  const download = await downloadResponse;
  expect(download.ok()).toBeTruthy();
  const downloadBody = (await download.json()) as { download?: { url?: unknown } };
  expect(typeof downloadBody.download?.url).toBe("string");
  await page.goto(resourceUrl);

  await page.getByLabel("Upload New Version").setInputFiles({
    name: secondFilename,
    mimeType: "text/markdown",
    buffer: Buffer.from(`# ${title}\n\nSecond preview body.`)
  });
  await page.getByRole("button", { name: "Upload Version" }).click();
  await expect(page.getByText("New version uploaded.")).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: secondFilename })).toBeVisible();
  await expect(page.getByRole("cell", { name: "v2", exact: true })).toBeVisible();

  await page.goto(`/materials?q=${encodeURIComponent(title)}`);
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await page.goto(resourceUrl);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/materials");
  await expect(page).toHaveURL(/\/login$/);
});

test("read-only member can browse but cannot mutate content", async ({ page, request }) => {
  await login(page, readonlyEmail, readonlyPassword);

  await page.goto("/materials");
  await expect(page.getByRole("heading", { name: "Materials" })).toBeVisible();
  const firstMaterial = page.getByRole("table").getByRole("link").first();
  await expect(firstMaterial).toBeVisible();
  await firstMaterial.click();
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  const downloadResponse = page.waitForResponse(
    (response) => response.url().includes("/api/resources/") && response.url().endsWith("/download")
  );
  await page.getByRole("button", { name: "Download" }).click();
  expect((await downloadResponse).ok()).toBeTruthy();

  await page.goto("http://localhost:3000/materials/upload");
  await expect(page.getByText("No writable courses are available for this account.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload Material" })).toBeDisabled();

  const csrfToken = await fetchCsrf(page);
  const courseId = await firstCourseId(page);
  const upload = await page.evaluate(
    async ({ csrfToken: token, courseId: selectedCourseId }) => {
      const formData = new FormData();
      formData.set("courseId", selectedCourseId);
      formData.set("categoryKey", "NOTES");
      formData.set("title", `Read-only forbidden ${Date.now()}`);
      formData.set("visibility", "COURSE_MEMBERS");
      formData.set("file", new File(["# denied"], "readonly-denied.md", { type: "text/markdown" }));
      const response = await fetch("/api/resources", {
        method: "POST",
        credentials: "include",
        headers: { "x-csrf-token": token },
        body: formData
      });
      return response.status;
    },
    { csrfToken, courseId }
  );
  expect(upload).toBe(403);

  const noteResponse = await apiPost(page, "/api/notes", {
    courseId,
    title: `Read-only note ${Date.now()}`,
    draftContent: "# denied",
    visibility: "COURSE_MEMBERS"
  });
  expect(noteResponse.status).toBe(403);

  const anonymousCsrf = await csrfForApiRequest(request);
  const mutateResponse = await request.post("/api/resources", {
    headers: {
      origin: "http://localhost:3000",
      "x-csrf-token": anonymousCsrf,
      cookie: `studyhub_csrf=${encodeURIComponent(anonymousCsrf)}`
    },
    multipart: {
      courseId,
      categoryKey: "NOTES",
      title: `Anonymous forbidden ${Date.now()}`,
      visibility: "COURSE_MEMBERS",
      file: {
        name: "anonymous.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("# denied")
      }
    }
  });
  expect(mutateResponse.status()).toBe(401);
});

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: /Welcome,/ })).toBeVisible();
}

async function fetchCsrf(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const response = await fetch("/api/auth/csrf", { credentials: "include" });
    const body = (await response.json()) as { csrfToken?: unknown };
    if (typeof body.csrfToken !== "string") {
      throw new Error("Missing CSRF token.");
    }
    return body.csrfToken;
  });
}

async function csrfForApiRequest(request: APIRequestContext): Promise<string> {
  const response = await request.get("/api/auth/csrf");
  const body = (await response.json()) as { csrfToken?: unknown };
  if (typeof body.csrfToken !== "string") {
    throw new Error("Missing anonymous CSRF token.");
  }
  return body.csrfToken;
}

async function firstCourseId(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const response = await fetch("/api/courses", { credentials: "include" });
    const body = (await response.json()) as { courses?: Array<{ id?: unknown }> };
    const courseId = body.courses?.find((course) => typeof course.id === "string")?.id;
    if (typeof courseId !== "string") {
      throw new Error("Expected at least one visible course.");
    }
    return courseId;
  });
}

async function apiPost(
  page: Page,
  path: string,
  payload: Record<string, unknown>
): Promise<{ status: number }> {
  return page.evaluate(
    async ({ path: requestPath, payload: requestPayload }) => {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include" });
      const csrfBody = (await csrfResponse.json()) as { csrfToken?: unknown };
      if (typeof csrfBody.csrfToken !== "string") {
        throw new Error("Missing CSRF token.");
      }
      const response = await fetch(requestPath, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfBody.csrfToken
        },
        body: JSON.stringify(requestPayload)
      });
      return { status: response.status };
    },
    { path, payload }
  );
}
