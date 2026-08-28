import { describe, expect, it } from "vitest";

import { resolveAccessRecoveryReturnTarget } from "../../access/recovery/access-recovery.rules";
import { createNotificationsAccessRecoveryPath } from "./notification-access-recovery.rules";

describe("Notifications access recovery handoff", () => {
  it("uses only the allowlisted clean production Notifications destination", () => {
    const recoveryUrl = new URL(createNotificationsAccessRecoveryPath(), "https://maiks.yt");
    const returnTarget = recoveryUrl.searchParams.get("returnTo");

    expect(recoveryUrl.pathname).toBe("/access/recovery");
    expect([...recoveryUrl.searchParams.keys()]).toEqual(["returnTo"]);
    expect(returnTarget).toBe("https://maiks.yt/tools/notifications");
    expect(resolveAccessRecoveryReturnTarget(returnTarget)).toBe(returnTarget);
    expect(recoveryUrl.toString()).not.toMatch(/accessToken|devAuthToken|notificationToken|secret|#/i);
  });
});
