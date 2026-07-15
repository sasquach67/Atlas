import { expect, test } from "@playwright/test";
import { resetDemoData } from "./helpers";

test.describe.serial("media upload transcription", () => {
  test("uploads a real file, transcribes it (mock), and rejects re-upload of the same bytes", async ({
    page,
  }) => {
    await resetDemoData(page);
    await page.goto("/inbox");

    const file = {
      name: "clinic-shift-recap.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("premed-atlas-e2e-fake-audio-bytes-0001"),
    };
    await page.getByLabel("Audio/video file").setInputFiles(file);
    await page.getByRole("button", { name: "Upload and transcribe" }).click();

    // The pipeline runs transcription (mock, delayed) then extraction.
    await expect(page.getByRole("link", { name: "Review claims" }).first()).toBeVisible({
      timeout: 20000,
    });
    await Promise.all([
      page.waitForURL(/\/inbox\/review\//),
      page.getByRole("link", { name: "Review claims" }).first().click(),
    ]);

    // A real timestamped transcript exists for the uploaded file.
    await expect(page.getByText("Edit the source transcript", { exact: false })).toBeVisible();
    await expect(page.getByText(/0:00/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Claims" })).toBeVisible();

    // Same bytes under a different filename → content-checksum duplicate.
    await page.goto("/inbox");
    await page
      .getByLabel("Audio/video file")
      .setInputFiles({ ...file, name: "renamed-copy.mp3" });
    await page.getByRole("button", { name: "Upload and transcribe" }).click();
    await expect(page.getByText("This file has already been imported.")).toBeVisible({
      timeout: 10000,
    });
  });
});
