import { expect, test } from "@playwright/test";

test("the comic-cover entry portal never scrolls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /hooded heroes/i })).toBeVisible();
  await expect(page.getByText("3,000", { exact: true })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.height).toBeLessThanOrEqual(dimensions.viewportHeight);
});

test("each founding hero opens a contained dossier", async ({ page }) => {
  await page.goto("/");
  for (const hero of ["Inferno", "Volt", "Pulse", "Circuit", "Phantom"]) {
    await page.getByRole("button", { name: `Meet ${hero}` }).click();
    await expect(page.getByRole("dialog", { name: `${hero} dossier` })).toBeVisible();
    await expect(page.getByRole("heading", { name: hero, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close panel" }).click();
  }
});

test("wallet preview state is clearly simulated", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /connect wallet/i }).click();
  await expect(page.getByText("WALLET CONNECTED")).toBeVisible();
  await expect(page.getByText(/preview clearance/i)).toBeVisible();
});

test("the headquarters door is the Society entrance", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter the Society headquarters" }).click();
  await expect(page.getByRole("dialog", { name: "society information" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "THE SOCIETY" })).toBeVisible();
});
