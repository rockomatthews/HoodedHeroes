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
  await expect(page.getByRole("region", { name: "HoodedHeroes Command Center" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.height).toBeLessThanOrEqual(dimensions.viewportHeight);

  const destinations = [
    ["Open Mission Deck", "Mission Deck panel"],
    ["Open Assembly", "Assembly panel"],
    ["Open Launch Bay", "Launch Bay panel"],
    ["Open Stock Token Vault", "Stock Token Vault panel"],
    ["Open Hero Workshop", "Hero Workshop panel"],
    ["Open Season 01", "Season 01 panel"],
    ["Open House Standings", "House Standings panel"],
    ["Open Become Legend", "Become Legend panel"],
    ["Open Messages", "Encrypted Messages panel"],
    ["Open My Missions", "My Missions panel"],
    ["Open My Vault", "My Vault panel"],
    ["Open Profile", "Hero Profile panel"],
  ] as const;

  for (const [button, dialog] of destinations) {
    await page.getByRole("button", { name: button }).click();
    await expect(page.getByRole("dialog", { name: dialog })).toBeVisible();
    await page.getByRole("button", { name: new RegExp(`Close ${dialog.replace(" panel", "")}`, "i") }).click();
  }

  await page.getByRole("button", { name: "Open Code Bazaar" }).click();
  await expect(page.getByRole("dialog", { name: "Code Bazaar panel" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Code Bazaar" })).toBeVisible();
  await page.getByRole("button", { name: "Run policy suite" }).click();
  await expect(page.getByText("4/4 CHECKS PASSED")).toBeVisible();
});

test("Launch Bay validates and queues an original fixed-supply proposal", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter the Society headquarters" }).click();
  await page.getByRole("button", { name: "Open Launch Bay" }).click();
  await expect(page.getByRole("textbox", { name: "Project name" })).toHaveValue("Night Signal");
  await expect(page.getByText("9/9")).toBeVisible();
  await page.getByRole("button", { name: "Submit signed proposal" }).click();
  await expect(page.getByRole("button", { name: /queued for review/i })).toBeVisible();
  await page.getByRole("slider", { name: "Creator allocation" }).fill("1200");
  await expect(page.getByText("BLOCKED")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit signed proposal" })).toBeDisabled();
});
