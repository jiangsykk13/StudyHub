import { expect, test } from "@playwright/test";

test("home page exposes auth links and private workspace routes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "StudyHub" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Register" })).toBeVisible();
  await expect(page.getByRole("link", { name: "/dashboard" })).toBeVisible();
});
