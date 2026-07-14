import { describe, expect, it } from "vitest";
import { createDatabase } from "@/db";
import { buildExportData, serializeExportJson, serializeExportMarkdown } from "./index";

describe("Premed Atlas export serializers", () => {
  it("serializes seed data to stable JSON", () => {
    const { repos } = createDatabase(":memory:");
    const json = serializeExportJson(buildExportData(repos, "2026-07-14T00:00:00.000Z"));
    expect(json).toMatchSnapshot();
  });

  it("serializes seed data to Markdown grouped by pillar", () => {
    const { repos } = createDatabase(":memory:");
    const markdown = serializeExportMarkdown(
      buildExportData(repos, "2026-07-14T00:00:00.000Z"),
    );
    expect(markdown).toMatchSnapshot();
  });
});
