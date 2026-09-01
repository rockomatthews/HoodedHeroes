import { expect, test } from "@playwright/test";

test("the comic-cover entry portal never scrolls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "HOODED", exact: true })).toBeVisible();
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

test("the public genesis vestibule uses the HOODED token identity", async ({ page }) => {
  await page.goto("/launch/hooded-genesis");
  await expect(page).toHaveTitle("HOODED (HOODED) — HOODED Launch Bay");
  await expect(page.getByRole("heading", { level: 1, name: "HOODED" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "$HOODED" })).toBeVisible();
  await expect(page.getByText("25,000 HOODED unlocks society preview")).toBeVisible();
});

test("mobile Command Center uses a zoomed comic district rail", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile navigation only");
  await page.goto("/");
  await page.getByRole("button", { name: "Enter the Society headquarters" }).click();
  const viewport = page.getByRole("region", { name: "HOODED Command Center" });
  const districtRail = page.getByRole("navigation", { name: "Command Center district navigation" });
  await expect(districtRail).toBeVisible();
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(300);
  const initial = await viewport.evaluate((element) => ({ left: element.scrollLeft, width: element.clientWidth, world: element.scrollWidth }));
  expect(initial.world).toBeGreaterThan(initial.width * 2);

  await districtRail.getByRole("button", { name: /LAUNCH/ }).click();
  await expect(page.getByText("LAUNCH DISTRICT")).toBeVisible();
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(initial.left + 150);

  await districtRail.getByRole("button", { name: /VAULT/ }).click();
  await expect(page.getByText("VAULT DISTRICT")).toBeVisible();
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeLessThan(initial.left);
});

test("the headquarters door is the Society entrance", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chrome", "Mobile navigation is covered by the district-rail flow");
  await page.goto("/");
  await page.getByRole("button", { name: "Enter the Society headquarters" }).click();
  await expect(page.getByRole("region", { name: "HOODED Command Center" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.height).toBeLessThanOrEqual(dimensions.viewportHeight);

  await expect(page.getByRole("button", { name: "Open Community Signal and HOODED Creed" })).toBeVisible();
  await page.getByRole("button", { name: "Open Community Signal and HOODED Creed" }).click();
  await expect(page.getByRole("dialog", { name: "Community Signal panel" })).toBeVisible();
  await expect(page.getByRole("region", { name: "The HOODED Creed" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Community Signal live chat" })).toBeVisible();
  await expect(page.getByText("Every utility bearing our crest is built, tested, and forever improved by the community.")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Community Signal channels" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Live society activity" })).toBeVisible();
  await page.getByRole("button", { name: /BUILDERS LOUNGE/ }).click();
  await expect(page.getByText(/Share reproducible evidence/)).toBeVisible();
  await page.getByRole("button", { name: "Close Community Signal" }).click();

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
  await expect(page.getByText("FOUNDRY-01 // FIRST SOCIETY PROJECT")).toBeVisible();
  await expect(page.getByText("v0.2.0-mainnet-canary")).toBeVisible();
  await page.getByRole("button", { name: "Hero Reward Rounds" }).click();
  await expect(page.getByText("packages/contracts/src/HeroRoundRewardVault.sol / proposal.ts")).toBeVisible();
  await expect(page.getByText("○ REQUIRED // O(1) round funding")).toBeVisible();
  await expect(page.getByText("○ REQUIRED // carry conservation")).toBeVisible();
  await page.getByRole("button", { name: "Run policy suite" }).click();
  await expect(page.getByText("5/5 CHECKS PASSED")).toBeVisible();
  await page.getByRole("button", { name: "OPEN BOUNTIES" }).click();
  await expect(page.getByText("LB-001 // security")).toBeVisible();
  await expect(page.getByText(/Prove conservation across every claim/i)).toBeVisible();
});

test("Launch Bay leads with HOODED genesis and keeps incomplete evidence blocked", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter the Society headquarters" }).click();
  await page.getByRole("button", { name: "Open Launch Bay" }).click();
  const launchPanel = page.getByRole("dialog", { name: "Launch Bay panel" });
  await expect(launchPanel).toBeVisible();
  if (testInfo.project.name === "desktop-chrome") {
    const panelDimensions = await launchPanel.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
    expect(panelDimensions.scrollHeight).toBeLessThanOrEqual(panelDimensions.clientHeight + 1);
  }
  await expect(page.getByRole("textbox", { name: "Project name" })).toHaveValue("HOODED");
  await expect(page.getByText("HOODED GENESIS", { exact: true })).toBeVisible();
  await expect(page.getByText("10/13")).toBeVisible();
  await expect(page.getByRole("button", { name: "3 GATES BLOCKED" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Bound owner wallet" }).fill("0x1111111111111111111111111111111111111111");
  await expect(page.getByText("11/13")).toBeVisible();
  await page.getByRole("button", { name: "SOLANA" }).click();
  await expect(page.getByRole("textbox", { name: "Project name" })).toHaveValue("Community Launch");
  await expect(page.getByRole("textbox", { name: "Quote asset" })).toHaveValue("SOL");
  await page.getByRole("button", { name: "METADATA" }).click();
  await expect(page.getByText(/Metaplex · Uniswap List/i)).toBeVisible();
});
