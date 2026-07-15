import { expect, test } from "@playwright/test";
import { resetDemoData } from "./helpers";

test.describe.serial("guide generation and reading", () => {
  test("generates the guide, traces a citation to a timestamped source, and regenerates stale sections", async ({
    page,
  }) => {
    await resetDemoData(page);

    // Generate from the guides page.
    await page.goto("/guides");
    await page.getByRole("button", { name: "Generate guide" }).click();
    await expect(page.getByRole("link", { name: /Read the guide/ })).toBeVisible({
      timeout: 20000,
    });

    // Read it.
    await page.getByRole("link", { name: /Read the guide/ }).click();
    await page.waitForURL(/\/guides\/atlas/);
    await expect(page.getByRole("heading", { name: "The Premed Atlas Guide" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "MCAT", exact: true, level: 2 }),
    ).toBeVisible();
    // The confirmed MCAT contradiction surfaces as a disagreement callout.
    await expect(page.getByText("Sources disagree.").first()).toBeVisible();

    // Citation chip → claim details → timestamped source trace.
    await page
      .getByRole("button", { name: /Citation \d+: Spread MCAT preparation/ })
      .first()
      .click();
    const viewInSource = page.getByRole("link", { name: "View in source" });
    await expect(viewInSource).toBeVisible();
    await expect(viewInSource).toHaveAttribute("href", /\/sources\/seed-src-mcat-yt\?t=12/);
    await viewInSource.click();
    await page.waitForURL(/\/sources\/seed-src-mcat-yt\?t=12/);

    // Editing an organized claim marks its guide section stale.
    const patch = await page.request.patch(
      "http://localhost:3000/api/claims/seed-claim-prereq-bio",
      { data: { canonicalText: "Most US MD programs expect a full year of biology with lab." } },
    );
    expect(patch.ok()).toBeTruthy();

    await page.goto("/guides");
    const regenerate = page.getByRole("button", { name: /Regenerate \d+ outdated/ });
    await expect(regenerate).toBeVisible();
    await regenerate.click();
    await expect(page.getByText(/v2 · current/).first()).toBeVisible({ timeout: 20000 });

    // The regenerated section carries the edited claim text.
    await page.goto("/guides/atlas");
    await expect(
      page.getByText("Most US MD programs expect a full year of biology with lab.", {
        exact: false,
      }).first(),
    ).toBeVisible();
  });
});
