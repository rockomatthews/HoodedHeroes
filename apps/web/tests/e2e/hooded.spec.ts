import { expect, test, type Page } from "@playwright/test";

async function grantHeroAccess(page: Page) {
  await page.route("**/api/access/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ configured: true, authenticated: true, wallet: "0x1111111111111111111111111111111111111111", access: "hero", hoodedBalance: "25000000000000000000000", genesisHeroBalance: "1" }),
    });
  });
}

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

test("the Society reveals the map before presenting the HOODED seal", async ({ page }) => {
  await page.route("**/api/access/status", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: true, authenticated: false, access: "vestibule" }) }));
  await page.goto("/");
  await page.getByRole("button", { name: "Enter the Society headquarters" }).click();
  await expect(page.getByRole("region", { name: "HOODED Command Center" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "HOODED membership required" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "HOODED membership required" })).toBeVisible();
  await expect(page.getByText("MINIMUM SIGNAL REQUIRED")).toBeVisible();
  await expect(page.getByText("25,000", { exact: true })).toBeVisible();
  await expect(page.getByText("Hold this amount to reveal the second seal.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Launch Bay" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "SIGN IN TO VERIFY" })).toBeVisible();
});

test("a verified HOODED holder meets the separate Genesis Hero seal", async ({ page }) => {
  await page.route("**/api/access/status", async (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ configured: true, authenticated: true, wallet: "0x2222222222222222222222222222222222222222", access: "preview", hoodedBalance: "25000000000000000000000", genesisHeroBalance: "0" }),
  }));
  await page.goto("/");
  await page.getByRole("button", { name: "Enter the Society headquarters" }).click();
  const gate = page.getByRole("dialog", { name: "Genesis Hero access required" });
  await expect(gate).toBeVisible();
  await expect(gate.getByText("FIRST SEAL ACCEPTED")).toBeVisible();
  await expect(gate.getByText("OWN 1 GENESIS HERO")).toBeVisible();
  await expect(gate.getByText("0 HEROES DETECTED")).toBeVisible();
  await expect(gate.getByRole("link", { name: /ACQUIRE A GENESIS HERO/ })).toHaveAttribute("href", "/launch/hooded-genesis#genesis-heroes");
});

test("the public genesis vestibule uses the HOODED token identity", async ({ page }) => {
  await page.goto("/launch/hooded-genesis");
  await expect(page).toHaveTitle("HOODED (HOODED) — HOODED Launch Bay");
  await expect(page.getByRole("heading", { level: 1, name: "HOODED" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "$HOODED" })).toBeVisible();
  await expect(page.getByText("25,000 HOODED reveals the second seal")).toBeVisible();
});

test("mobile Command Center uses a zoomed comic district rail", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile navigation only");
  await grantHeroAccess(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Enter the Society headquarters" }).click();
  const viewport = page.getByRole("region", { name: "HOODED Command Center" });
  const districtRail = page.getByRole("navigation", { name: "Command Center district navigation" });
  await expect(districtRail).toBeVisible();
  await expect(districtRail.getByRole("button", { name: /LAUNCH/ })).toBeEnabled();
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
  await grantHeroAccess(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Enter the Society headquarters" }).click();
  await expect(page.getByRole("region", { name: "HOODED Command Center" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.height).toBeLessThanOrEqual(dimensions.viewportHeight);

  await expect(page.getByRole("button", { name: "Open Community Signal and HOODED Creed" })).toBeEnabled();
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

  await page.getByRole("button", { name: "Open My Vault" }).click();
  const vaultPanel = page.getByRole("dialog", { name: "My Vault panel" });
  await expect(page.getByRole("region", { name: "Hero reward ledger" })).toBeVisible();
  const vaultDimensions = await vaultPanel.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
  expect(vaultDimensions.scrollHeight).toBeLessThanOrEqual(vaultDimensions.clientHeight + 1);
  await expect(page.getByText("UNIVERSAL HERO REWARDS // PUBLIC LEDGER")).toBeVisible();
  await expect(page.getByText("CANARY NOT CONFIGURED")).toBeVisible();
  await page.getByRole("button", { name: "Close My Vault" }).click();

  await page.getByRole("button", { name: "Open Mission Deck" }).click();
  await expect(page.getByRole("region", { name: "Mission Deck operations" })).toBeVisible();
  await expect(page.getByText("NO REWARD CREDIT")).toBeVisible();
  await page.getByRole("button", { name: "START GRID" }).click();
  await expect(page.getByRole("grid", { name: "Power Grid practice board" })).toBeVisible();
  await page.getByRole("button", { name: "Close Mission Deck" }).click();

  await page.getByRole("button", { name: "Open Assembly" }).click();
  await expect(page.getByRole("region", { name: "Assembly governance" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Reviewed evidence hash" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ATTEST PEER APPROVAL" })).toBeDisabled();
  await page.getByRole("button", { name: "Close Assembly" }).click();

  await page.getByRole("button", { name: "Open Stock Token Vault" }).click();
  await expect(page.getByRole("region", { name: "Stock Token Vault eligibility" })).toBeVisible();
  await expect(page.getByText("UNVERIFIED", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "CHECK ELIGIBILITY" }).click();
  await expect(page.getByText(/GENESIS-HERO-GATED SESSION IS REQUIRED/)).toBeVisible();
  await page.getByRole("button", { name: "Close Stock Token Vault" }).click();

  await page.getByRole("button", { name: "Open Hero Workshop" }).click();
  await expect(page.getByRole("region", { name: "Hero Workshop loadout" })).toBeVisible();
  await page.getByRole("button", { name: "CIPHER SIGHT" }).click();
  await expect(page.getByText("CIPHER SIGHT", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "SAVE LOADOUT" }).click();
  await expect(page.getByText(/GENESIS-HERO-GATED SESSION IS REQUIRED/)).toBeVisible();
  await page.getByRole("button", { name: "Close Hero Workshop" }).click();

  await page.getByRole("button", { name: "Open Code Bazaar" }).click();
  await expect(page.getByRole("dialog", { name: "Code Bazaar panel" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Code Bazaar" })).toBeVisible();
  await expect(page.getByText("FOUNDRY-01 // FIRST SOCIETY PROJECT")).toBeVisible();
  await expect(page.getByText("v1.7.0-factory-bound-v4-adapter")).toBeVisible();
  await page.getByRole("button", { name: "Hero Reward Rounds" }).click();
  await expect(page.getByText("packages/contracts/src/HeroRoundRewardVault.sol", { exact: true })).toBeVisible();
  await expect(page.getByText("○ REQUIRED // O(1) round funding")).toBeVisible();
  await expect(page.getByText("○ REQUIRED // manifest-bound fee harvest")).toBeVisible();
  await expect(page.getByText("○ REQUIRED // carry conservation")).toBeVisible();
  await expect(page.getByRole("button", { name: "SAVE ISOLATED EDIT" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "RUN REVIEWED TEST PRESET" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "CONNECT GITHUB" })).toBeVisible();
  await page.getByRole("button", { name: "OPEN BOUNTIES" }).click();
  await expect(page.getByText("LB-001 // security")).toBeVisible();
  await expect(page.getByText(/Prove conservation across every claim/i)).toBeVisible();
});

test("Launch Bay leads with HOODED genesis and keeps incomplete evidence blocked", async ({ page }, testInfo) => {
  await grantHeroAccess(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Enter the Society headquarters" }).click();
  const launchButton = page.getByRole("button", { name: "Open Launch Bay" });
  await expect(launchButton).toBeEnabled();
  await launchButton.click();
  const launchPanel = page.getByRole("dialog", { name: "Launch Bay panel" });
  await expect(launchPanel).toBeVisible();
  if (testInfo.project.name === "desktop-chrome") {
    const panelDimensions = await launchPanel.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
    expect(panelDimensions.scrollHeight).toBeLessThanOrEqual(panelDimensions.clientHeight + 1);
  }
  await expect(page.getByRole("textbox", { name: "Project name" })).toHaveValue("HOODED");
  await expect(page.getByText("HOODED GENESIS", { exact: true })).toBeVisible();
  await expect(page.getByText("12/15")).toBeVisible();
  await expect(page.getByRole("button", { name: "3 GATES BLOCKED" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Bound owner wallet" }).fill("0x1111111111111111111111111111111111111111");
  await expect(page.getByText("13/15")).toBeVisible();
  await expect(page.getByRole("button", { name: "BASE" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "SOLANA" })).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "Quote asset" })).toHaveValue("ETH");
  await page.getByRole("button", { name: "METADATA" }).click();
  await expect(page.getByText(/Metaplex · Uniswap List/i)).toBeVisible();
});
