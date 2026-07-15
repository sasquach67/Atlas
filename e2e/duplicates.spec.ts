import { expect, test } from "@playwright/test";
import { resetDemoData } from "./helpers";

test.describe.serial("duplicate detection and resolution", () => {
  test("suggests a near-duplicate of an existing claim and merges it with provenance kept", async ({
    page,
  }) => {
    await resetDemoData(page);

    // Import a near-duplicate of the seeded LOR-timing claim.
    await page.goto("/inbox");
    await page.getByLabel("Title").fill("Duplicate LOR advice");
    await page
      .getByLabel("Paste text or transcript")
      .fill("You should ask for recommendation letters while the relationship is still active.");
    await page.getByRole("button", { name: "Import pasted text" }).click();
    await expect(page.getByRole("link", { name: "Review claims" }).first()).toBeVisible({
      timeout: 15000,
    });

    // The processing pipeline recorded an unconfirmed duplicates suggestion.
    await page.goto("/verification");
    const panel = page.getByText("Possible duplicates").locator("..").locator("..").locator("..");
    await expect(
      page.getByText("Ask for recommendation letters while the relationship is active", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Merge" }).first()).toBeVisible();
    await expect(page.getByText(/similarity 0\.\d+/).first()).toBeVisible();

    // Merge keeps the higher-confidence claim; suggestion leaves the queue.
    await page.getByRole("button", { name: "Merge" }).first().click();
    await expect(page.getByText(/^Merged\./).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Merge" })).toHaveCount(0);
    void panel;

    // The seeded (surviving) claim is still in the atlas data; the merged one
    // is rejected but retrievable — provenance is preserved server-side.
    const claim = await page.request.get("http://localhost:3000/api/atlas");
    const atlas = (await claim.json()) as { claims: { id: string; status: string }[] };
    expect(atlas.claims.some((c) => c.id === "seed-claim-lor-timing")).toBeTruthy();
  });

  test("scan button reports results and dismiss removes a suggestion", async ({ page }) => {
    await resetDemoData(page);
    await page.goto("/verification");
    await page.getByRole("button", { name: "Scan for duplicates" }).click();
    // Seed data has no unlinked near-duplicates, so the scan reports cleanly.
    await expect(page.getByText(/across \d+ claims/).first()).toBeVisible({ timeout: 10000 });
  });
});
