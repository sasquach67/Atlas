import { expect, test } from "@playwright/test";
import { resetDemoData } from "./helpers";

test.describe.serial("inbox ingestion smoke", () => {
  test("imports pasted advice, reviews claims, and sends approved claims to Atlas", async ({
    page,
  }) => {
    await resetDemoData(page);
    await page.goto("/inbox");

    await page.getByLabel("Title").fill("LOR timing smoke import");
    await page.getByLabel("Platform").fill("Notebook");
    await page.getByLabel("Creator").fill("Premed advisor");
    await page
      .getByLabel("Paste text or transcript")
      .fill(
        [
          "Ask for recommendation letters while the professor still remembers your work.",
          "Do not wait two years after the class ends because the letter becomes generic.",
          "Bring a resume and a short paragraph about why medicine when you ask.",
        ].join(" "),
      );
    await page.getByRole("button", { name: "Import pasted text" }).click();

    await expect(page.getByRole("link", { name: "Review claims" }).first()).toBeVisible({
      timeout: 15000,
    });
    await Promise.all([
      page.waitForURL(/\/inbox\/review\//),
      page.getByRole("link", { name: "Review claims" }).first().click(),
    ]);
    await expect(page.getByRole("heading", { name: "Claims" })).toBeVisible();

    await page
      .getByLabel("Canonical claim")
      .first()
      .fill("Edited smoke claim: ask while the professor still remembers your work.");
    await page.getByLabel("Pillar").first().selectOption("letters");
    await page.getByRole("button", { name: "Save edits" }).first().click();
    await page.getByRole("button", { name: /^Approve$/ }).first().click();

    await expect(page.getByRole("button", { name: /Send [1-9]\d* approved claims to Atlas/ })).toBeEnabled();
    await page.getByRole("button", { name: /Send [1-9]\d* approved claims to Atlas/ }).click();
    await expect(page.getByRole("link", { name: "Open Atlas" })).toBeVisible();
  });
});
