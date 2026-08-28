import { describe, expect, it } from "vitest";

import {
  createCanonicalAccessRecoveryPath,
  createAccessRecoveryCallbackUrl,
  resolveAccessRecoveryReturnTarget
} from "./access-recovery.rules";

describe("PWA access recovery return target rules", () => {
  it.each([
    ["https://control.maiks.yt/control", "https://control.maiks.yt/control"],
    ["https://control.maiks.yt/control/providers", "https://control.maiks.yt/control/providers"],
    ["https://control.maiks.yt/chat", "https://control.maiks.yt/chat"],
    ["https://control.maiks.yt/moderation/rules", "https://control.maiks.yt/moderation/rules"],
    ["https://maiks.yt/tools/notifications", "https://maiks.yt/tools/notifications"]
  ])("allows the intended PWA destination %s", (value, expected) => {
    expect(resolveAccessRecoveryReturnTarget(value)).toBe(expected);
  });

  it("strips query and hash material from allowed return targets", () => {
    expect(
      resolveAccessRecoveryReturnTarget("https://control.maiks.yt/control?accessToken=secret-token&devAuthToken=dev#part")
    ).toBe("https://control.maiks.yt/control");
  });

  it.each([
    null,
    "",
    "/control",
    "https://control.maiks.yt/account",
    "https://control.maiks.yt.evil.example/control",
    "https://maiks.yt/account",
    "https://www.maiks.yt/tools/notifications",
    "http://control.maiks.yt/control",
    "https://user:pass@control.maiks.yt/control",
    "https://evil.example/control"
  ])("rejects unsafe return target %s", (value) => {
    expect(resolveAccessRecoveryReturnTarget(value)).toBeNull();
  });

  it("builds the OAuth callback only from the sanitized return target", () => {
    expect(
      createAccessRecoveryCallbackUrl("https://maiks.yt", "https://control.maiks.yt/control")
    ).toBe("https://maiks.yt/access/recovery?returnTo=https%3A%2F%2Fcontrol.maiks.yt%2Fcontrol");
    expect(createAccessRecoveryCallbackUrl("https://maiks.yt", null)).toBe("https://maiks.yt/access/recovery");
  });

  it("canonicalizes recovery requests before token-shaped query input can render", () => {
    expect(createCanonicalAccessRecoveryPath(new URL(
      "https://maiks.yt/access/recovery?returnTo=https%3A%2F%2Fcontrol.maiks.yt%2Fcontrol%3FaccessToken%3Dsecret-token%26devAuthToken%3Ddev-secret"
    ))).toBe("/access/recovery?returnTo=https%3A%2F%2Fcontrol.maiks.yt%2Fcontrol");
    expect(createCanonicalAccessRecoveryPath(new URL(
      "https://maiks.yt/access/recovery?returnTo=https%3A%2F%2Fevil.example%2Fcontrol&accessToken=outer-token"
    ))).toBe("/access/recovery");
  });
});
