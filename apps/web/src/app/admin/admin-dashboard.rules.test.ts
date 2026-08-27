import { describe, expect, it } from "vitest";

import {
  adminDashboardStatusRequestPaths,
  createAdminDashboardLoadingCards
} from "./admin-dashboard.rules";

describe("admin dashboard status inventory", () => {
  it("does not depend on the development smoke-state surface", () => {
    const requestPaths = Object.values(adminDashboardStatusRequestPaths);
    const loadingCards = createAdminDashboardLoadingCards();
    const serializedCards = JSON.stringify(loadingCards);

    expect(requestPaths).not.toContain("/admin/testing/smoke-state");
    expect(loadingCards.map((card) => card.key)).not.toContain("smoke");
    expect(serializedCards).not.toContain("Automated Checks");
    expect(serializedCards).not.toContain("automated check");
  });

  it("retains the production overview health inputs", () => {
    expect(Object.values(adminDashboardStatusRequestPaths)).toEqual([
      "/health",
      "/health/database",
      "/admin/notifications?limit=5",
      "/admin/connections/intake/health",
      "/admin/sessions",
      "/admin/backup/health",
      "/admin/local-agent/status",
      "/admin/overview/activity",
      "/admin/money/ledger"
    ]);
    expect(createAdminDashboardLoadingCards().map((card) => card.key)).toEqual([
      "api",
      "database",
      "notifications",
      "provider-intake",
      "sessions",
      "backup",
      "local-agent",
      "live-alerts",
      "helpers",
      "money"
    ]);
  });
});
