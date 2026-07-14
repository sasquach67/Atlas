import { expect, test, type Locator } from "@playwright/test";

async function nodeTranslate(locator: Locator) {
  return locator.evaluate((element) => {
    const transform = (element as HTMLElement).style.transform;
    const match = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(transform);
    if (!match) return { x: 0, y: 0, raw: transform };
    return { x: Number(match[1]), y: Number(match[2]), raw: transform };
  });
}

test.describe.serial("atlas canvas", () => {
  test("organizes seeded unsorted claims and opens source trace", async ({ page }) => {
    await page.goto("/atlas");

    await expect(page.getByRole("button", { name: "Organize 4 unsorted" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("4 claim chips")).toBeVisible();

    const claimNode = page
      .getByTestId("claim-node-seed-claim-500hours")
      .locator("xpath=ancestor::*[contains(@class, 'react-flow__node')]");
    const before = await nodeTranslate(claimNode);

    await page.getByRole("button", { name: "Organize 4 unsorted" }).click();
    await expect(page.getByRole("heading", { name: "Organize 4 Unsorted Claims" })).toBeVisible();
    await page.getByRole("button", { name: "Organize Claims" }).click();
    await expect(page.getByRole("button", { name: "Organize 0 unsorted" })).toBeVisible({
      timeout: 10000,
    });

    const after = await nodeTranslate(claimNode);
    expect(after.x).toBeGreaterThan(before.x + 1000);
    expect(after.x).toBeGreaterThan(3200);

    await page.getByLabel("Search atlas").fill("clinical hours");
    const mcatNode = page
      .getByTestId("claim-node-seed-claim-mcat-long")
      .locator("xpath=ancestor::*[contains(@class, 'react-flow__node')]");
    await expect(mcatNode).toHaveClass(/opacity-25/);

    await claimNode.click();
    await expect(page.getByRole("heading", { name: "Claim Detail" })).toBeVisible();
    await page.getByRole("link", { name: "View in source" }).click();
    await expect(page).toHaveURL(/\/sources\/seed-src-clinical\?t=18/);
  });
});
