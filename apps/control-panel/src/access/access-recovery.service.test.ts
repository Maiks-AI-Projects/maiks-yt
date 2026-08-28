import { describe, expect, it } from "vitest";

import { createAccessRecoveryUrl } from "./access-recovery.service.js";

describe("Control access recovery handoff", () => {
  it("builds a website recovery URL without forwarding the launch token", () => {
    const recoveryUrl = createAccessRecoveryUrl({
      currentHref: "https://control.maiks.yt/control/music?accessToken=raw-launch-token&page=music",
      webBaseUrl: "https://maiks.yt"
    });

    expect(recoveryUrl).toBe(
      "https://maiks.yt/access/recovery?returnTo=https%3A%2F%2Fcontrol.maiks.yt%2Fcontrol%2Fmusic"
    );
    expect(recoveryUrl).not.toContain("raw-launch-token");
    expect(recoveryUrl).not.toContain("accessToken");
  });

  it("removes token-shaped dev and generic parameters before leaving the PWA origin", () => {
    const recoveryUrl = createAccessRecoveryUrl({
      currentHref: "http://localhost:3003/chat?token=secret&devAuthToken=dev-secret&mode=compact",
      webBaseUrl: "http://localhost:3000"
    });

    expect(recoveryUrl).toBe(
      "http://localhost:3000/access/recovery?returnTo=http%3A%2F%2Flocalhost%3A3003%2Fchat"
    );
    expect(recoveryUrl).not.toContain("secret");
    expect(recoveryUrl).not.toContain("token=");
    expect(recoveryUrl).not.toContain("devAuthToken");
  });
});
