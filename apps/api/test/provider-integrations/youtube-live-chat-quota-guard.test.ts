import type { DatabasePool } from "@maiks-yt/database";
import { describe, expect, it, vi } from "vitest";

import {
  createYouTubeLiveChatQuotaGuard,
  youtubeLiveChatQuotaExhaustedSentinel
} from "../../src/provider-integrations/youtube-live-chat-intake-control-store.service.js";

describe("createYouTubeLiveChatQuotaGuard", () => {
  it("persists, reads, and selectively clears the quota sentinel", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([[{ blocked: 1 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const guard = createYouTubeLiveChatQuotaGuard({ execute } as unknown as DatabasePool);

    await expect(guard.isBlocked()).resolves.toBe(true);
    await guard.block();
    await guard.clear();

    expect(execute).toHaveBeenCalledTimes(3);
    for (const call of execute.mock.calls) {
      expect(call[1]).toEqual([youtubeLiveChatQuotaExhaustedSentinel]);
    }
    expect(String(execute.mock.calls[2]?.[0])).toContain("last_error = ?");
  });
});
