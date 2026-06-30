import { expect, test, type Page } from "@playwright/test";

const memberEmail = process.env.E2E_MEMBER_EMAIL ?? "member@example.test";
const memberPassword = process.env.E2E_MEMBER_PASSWORD ?? "ChangeMe-Member-DevOnly-12345";

const primaryScreens = [
  { path: "/dashboard", heading: /Welcome,/ },
  { path: "/courses", heading: "Courses" },
  { path: "/materials", heading: "Materials" },
  { path: "/notes", heading: "Notes" },
  { path: "/favorites", heading: "Favorites" },
  { path: "/profile", heading: "Profile" }
] as const;

test("primary authenticated screens render at desktop and mobile sizes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 }
  ] as const) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const screen of primaryScreens) {
      await page.goto(screen.path);
      await expect(page.getByRole("heading", { name: screen.heading })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
    }
  }
});

async function login(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(memberEmail);
  await page.getByLabel("Password").fill(memberPassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: /Welcome,/ })).toBeVisible();
}
