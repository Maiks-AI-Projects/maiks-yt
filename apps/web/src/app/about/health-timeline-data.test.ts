import { describe, expect, it } from "vitest";

import { healthTimeline, sourceOnlyUnrenderedHealthHistory } from "./health-timeline-data";

describe("health timeline data", () => {
  it("keeps old injury history recoverable without rendering it publicly", () => {
    expect(sourceOnlyUnrenderedHealthHistory).toEqual([
      expect.objectContaining({
        title: "Broken right hand",
        year: 2014
      }),
      expect.objectContaining({
        title: "Unrelated head-injury assessment",
        year: 2018
      })
    ]);

    expect(healthTimeline.map((entry) => entry.year)).toEqual([
      2017,
      2018,
      2019,
      2020,
      2021,
      2022,
      2023,
      2024,
      2025,
      2026
    ]);

    const renderedCopy = healthTimeline.flatMap((entry) => [
      entry.title,
      entry.summary,
      ...entry.metrics.flatMap((metric) => [metric.value, metric.label])
    ]).join(" ");

    expect(renderedCopy).toContain("low-grade brain tumour");
    expect(renderedCopy).toContain("brain MRI scans");
    expect(renderedCopy).not.toContain("Broken right hand");
    expect(renderedCopy).not.toContain("documented hand X-rays");
    expect(renderedCopy).not.toContain("head injury");
    expect(renderedCopy).not.toContain("emergency assessment");
    expect(renderedCopy).not.toContain("CT scan");
  });
});
