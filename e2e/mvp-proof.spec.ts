import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { resetDemoData } from "./helpers";

test.describe.serial("E.44 MVP proof", () => {
  test("walks upload to timestamp trace to export", async ({ page }, testInfo) => {
    await resetDemoData(page);

    const editedClaim =
      "Edited MVP proof claim: ask for letters while the relationship is still active.";
    const fixturePath = path.join(testInfo.outputDir, "mock-audio.mp3");
    fs.mkdirSync(testInfo.outputDir, { recursive: true });
    fs.writeFileSync(fixturePath, Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00]));

    await page.goto("/inbox");
    await page.getByLabel("Title").fill("MVP proof audio import");
    await page.getByLabel("Audio/video file").setInputFiles(fixturePath);
    await page.getByRole("button", { name: "Import file metadata" }).click();

    await expect(page.getByRole("link", { name: "Review claims" }).first()).toBeVisible({
      timeout: 15000,
    });
    await Promise.all([
      page.waitForURL(/\/inbox\/review\//),
      page.getByRole("link", { name: "Review claims" }).first().click(),
    ]);

    await expect(page.getByText("Transcript", { exact: true }).first()).toBeVisible();
    await expect(page.locator(".font-mono").filter({ hasText: "0:00" }).first()).toBeVisible();
    await expect(page.getByLabel("Canonical claim").first()).toBeVisible();

    await page.getByLabel("Canonical claim").first().fill(editedClaim);
    await page.getByRole("button", { name: "Save edits" }).first().click();
    await page.reload();
    await expect(page.getByLabel("Canonical claim").first()).toHaveValue(editedClaim);

    await page.getByRole("button", { name: /^Approve$/ }).first().click();
    await expect(page.getByRole("button", { name: /Send [1-9]\d* approved claims to Atlas/ })).toBeEnabled();
    await page.getByRole("button", { name: /Send [1-9]\d* approved claims to Atlas/ }).click();
    await page.getByRole("link", { name: "Open Atlas" }).click();

    await expect(page.getByRole("button", { name: /Organize \d+ unsorted/ })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("button", { name: /Organize \d+ unsorted/ }).click();
    await page.getByRole("button", { name: "Organize Claims" }).click();
    await expect(page.getByRole("button", { name: "Organize 0 unsorted" })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: "Fit View" }).click();

    await page.getByLabel("Search atlas").fill("Edited MVP proof");
    await page.getByRole("button", { name: editedClaim }).click();
    await expect(page.getByRole("heading", { name: "Claim Detail" })).toBeVisible();
    await page.getByRole("link", { name: "View in source" }).click();
    await expect(page).toHaveURL(/\/sources\/.+\?t=\d+/);
    await expect(page.getByText(editedClaim)).toBeVisible();

    await page.goto("/settings");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Export Markdown" }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const exported = fs.readFileSync(downloadPath!, "utf8");
    expect(exported).toContain(editedClaim);
  });
});
