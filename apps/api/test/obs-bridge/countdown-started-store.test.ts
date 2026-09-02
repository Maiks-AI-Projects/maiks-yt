import { describe, expect, it, vi } from "vitest";

import { createCountdownStartedRecorder } from "../../src/obs-bridge/index.js";

const payload = {
  occurrenceId: "11111111-1111-4111-8111-111111111111",
  countdownRuntimeId: "last-caretaker-runtime-v2" as const,
  durationSeconds: 600 as const,
  startedAt: "2026-09-02T16:00:00.000Z",
  endsAt: "2026-09-02T16:10:00.000Z",
  triggerSource: "stream_deck" as const
};

describe("countdown started durable recorder", () => {
  it("stores a new occurrence and reports accepted", async () => {
    const execute = vi.fn().mockResolvedValue([{ affectedRows: 1 }]);
    const record = createCountdownStartedRecorder({ execute } as never);

    await expect(record(payload)).resolves.toBe("accepted");
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]?.[1]?.[0]).toBe(payload.occurrenceId);
  });

  it("accepts only an exact duplicate of an existing occurrence", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([[{
        streamSessionId: null,
        type: "stream.countdown.started",
        payload
      }]]);
    const record = createCountdownStartedRecorder({ execute } as never);

    await expect(record(payload)).resolves.toBe("duplicate");
  });

  it("deduplicates a restart of the same logical occurrence without rewriting the first event", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([[{
        streamSessionId: null,
        type: "stream.countdown.started",
        payload: { ...payload, endsAt: "2026-09-02T16:11:00.000Z" }
      }]]);
    const record = createCountdownStartedRecorder({ execute } as never);

    await expect(record(payload)).resolves.toBe("duplicate");
  });
});
