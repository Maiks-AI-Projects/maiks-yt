import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AccessRecoveryPage from "./page";
import { projectConfiguredProviders } from "../../oauth-provider-config.service";

describe("PWA access recovery page", () => {
  it("renders the approved logo asset and recovery-only token boundary copy", async () => {
    const markup = renderToStaticMarkup(await AccessRecoveryPage({
      searchParams: Promise.resolve({
        returnTo: "https://control.maiks.yt/control?accessToken=secret-token"
      })
    }));

    expect(markup).toContain("/brand/icon-64.png");
    expect(markup).toContain("Get back into your PWA.");
    expect(markup).toContain("does not copy the installed window");
    expect(markup).toContain("checks its saved launch token again");
    expect(markup).not.toContain("secret-token");
  });

  it("does not render unsafe return targets into page markup", async () => {
    const markup = renderToStaticMarkup(await AccessRecoveryPage({
      searchParams: Promise.resolve({
        returnTo: "https://evil.example/control"
      })
    }));

    expect(markup).not.toContain("https://evil.example/control");
  });

  it("projects only configured known OAuth providers in production order", () => {
    expect(projectConfiguredProviders({
      ok: true,
      configuredProviderIds: ["discord", "google", "unknown", "google"]
    })).toEqual([
      { id: "google", label: "Continue with Google" },
      { id: "discord", label: "Continue with Discord" }
    ]);
  });

  it.each([
    null,
    {},
    { ok: true, configuredProviderIds: "github" },
    { ok: false, configuredProviderIds: ["github"] }
  ])("fails closed for malformed provider config %#", (payload) => {
    expect(projectConfiguredProviders(payload)).toEqual([]);
  });
});
