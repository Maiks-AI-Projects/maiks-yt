import { describe, expect, it } from "vitest";

import { canDisableLoginForLinkedAccount, type LinkedAccount } from "../src/identity/index.js";

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
