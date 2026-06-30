import { expect, test } from "@playwright/test";

const memberEmail = process.env.E2E_MEMBER_EMAIL ?? "member@example.test";
const memberPassword = process.env.E2E_MEMBER_PASSWORD ?? "ChangeMe-Member-DevOnly-12345";

test("member creates, publishes, revises, restores, and favorites a note", async ({ page }) => {
  const title = `E2E note ${Date.now()}`;
  const firstContent = [
    "# E2E Heading",
    "",
    "```ts",
    "const total: number = 2;",
    "```",
    "",
    "$x^2$",
    "",
    "```mermaid",
    "graph TD",
    "A-->B",
    "```",
    "",
    "<script>window.__studyhubUnsafe = true</script>",
    "[bad](javascript:alert(1))"
  ].join("\n");

  await page.goto("/login");
  await page.getByLabel("Email").fill(memberEmail);
  await page.getByLabel("Password").fill(memberPassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: /Welcome,/ })).toBeVisible();

  await page.goto("/notes/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Markdown").fill(firstContent);
  const createResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/notes") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Publish" }).click();
  const created = await createResponse;
  expect(created.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "E2E Heading" })).toBeVisible();
  await expect(page.locator(".katex").first()).toBeVisible();
  await expect(page.locator("svg").first()).toBeVisible();
  await expect(
    page
      .locator("section", { has: page.getByRole("heading", { name: "E2E Heading" }) })
      .locator("script")
  ).toHaveCount(0);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(
    page.evaluate(() => (window as typeof window & { __studyhubUnsafe?: boolean }).__studyhubUnsafe)
  ).resolves.toBeUndefined();

  await page.getByRole("button", { name: "Add favorite" }).click();
  await expect(page.getByRole("button", { name: "Remove favorite" })).toBeVisible();
  await page.goto("/favorites");
  await expect(page.getByRole("link", { name: title })).toBeVisible();

  await page.getByRole("link", { name: title }).click();
  await page.getByRole("link", { name: "Edit note" }).click();
  await page.getByLabel("Markdown").fill("# Revised E2E Heading\n\nUpdated content.");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("heading", { name: "Revised E2E Heading" })).toBeVisible();

  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.getByRole("button", { name: "Restore" }).last().click();
  await expect(page.getByRole("heading", { name: "E2E Heading" })).toBeVisible();
});
