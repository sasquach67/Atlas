import { expect, type Page } from "@playwright/test";

export async function resetDemoData(page: Page) {
  const response = await page.request.post("http://localhost:3000/api/admin/reset");
  expect(response.ok()).toBeTruthy();
}
