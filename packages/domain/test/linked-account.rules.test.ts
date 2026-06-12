import { describe, expect, it } from "vitest";

import {
  canDisableLoginForLinkedAccount,
  canProviderUseCapability,
  decideLinkedAccountClaim,
  getDefaultCapabilitiesForProvider,
  type LinkedAccount
} from "../src/identity/index.js";

const loginAccount = (id: string, allowLogin = true): LinkedAccount => ({
  id,
  provider: "test",
  providerAccountId: id,
  displayName: id,
  capabilities: ["login"],
  allowLogin
});

describe("canDisableLoginForLinkedAccount", () => {
  it("blocks disabling the only enabled login account", () => {
    expect(canDisableLoginForLinkedAccount([loginAccount("one")], "one")).toBe(false);
  });

  it("allows disabling one login account when another remains enabled", () => {
    expect(canDisableLoginForLinkedAccount([loginAccount("one"), loginAccount("two")], "one")).toBe(true);
  });

  it("allows disabling an account that is already not a login method", () => {
    const profileOnlyAccount: LinkedAccount = {
      ...loginAccount("profile-only"),
      capabilities: ["profile-avatar"],
      allowLogin: false
    };

    expect(canDisableLoginForLinkedAccount([loginAccount("one"), profileOnlyAccount], "profile-only")).toBe(true);
  });
});

describe("provider capabilities", () => {
  it("declares login and channel routing for Twitch", () => {
    expect(getDefaultCapabilitiesForProvider("twitch")).toEqual([
      "login",
      "support-claiming",
      "profile-avatar",
      "channel-routing"
    ]);
  });

  it("keeps Patreon support-capable without treating it as a login provider by default", () => {
    expect(canProviderUseCapability("patreon", "support-claiming")).toBe(true);
    expect(canProviderUseCapability("patreon", "login")).toBe(false);
  });

  it("returns no capabilities for unknown providers", () => {
    expect(getDefaultCapabilitiesForProvider("unknown")).toEqual([]);
  });
});

describe("decideLinkedAccountClaim", () => {
  it("allows unclaimed provider accounts", () => {
    expect(decideLinkedAccountClaim([], {
      provider: "twitch",
      providerAccountId: "123",
      userId: "user-one"
    })).toEqual({
      allowed: true,
      reason: "unclaimed"
    });
  });

  it("allows a user to re-sync their own provider account", () => {
    expect(decideLinkedAccountClaim([{
      provider: "twitch",
      providerAccountId: "123",
      userId: "user-one"
    }], {
      provider: "twitch",
      providerAccountId: "123",
      userId: "user-one"
    })).toEqual({
      allowed: true,
      reason: "already-owned-by-user"
    });
  });

  it("blocks claiming a provider account owned by a different user", () => {
    expect(decideLinkedAccountClaim([{
      provider: "twitch",
      providerAccountId: "123",
      userId: "user-one"
    }], {
      provider: "twitch",
      providerAccountId: "123",
      userId: "user-two"
    })).toEqual({
      allowed: false,
      reason: "claimed-by-different-user"
    });
  });
});
