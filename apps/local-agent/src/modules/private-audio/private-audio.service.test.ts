import { describe, expect, it, vi } from "vitest";
import type { CommandEnvelope } from "../../protocol/agent-protocol.types.js";
import { createCueWav } from "./private-cue-data.js";
import { PrivateAudioModule } from "./private-audio.service.js";
import type { PrivateAudioBackend } from "./private-audio.types.js";

function command(action: string, payload: unknown): CommandEnvelope {
  return {
    type: "command",
    eventId: "event-1",
    commandId: "command-1",
    issuedAt: new Date().toISOString(),
    capability: "private-audio",
    action,
    payload
  };
}

describe("PrivateAudioModule", () => {
  it("advertises only locally available actions and validates cue bounds", async () => {
    const playCue = vi.fn<PrivateAudioBackend["playCue"]>().mockResolvedValue(undefined);
    const backend: PrivateAudioBackend = {
      inspect: async () => ({ cue: true, tts: false, detail: "Cue ready" }),
      playCue,
      speak: vi.fn<PrivateAudioBackend["speak"]>()
    };
    const module = new PrivateAudioModule(backend);
    const signal = new AbortController().signal;
    await module.start({ signal, reportStatus: vi.fn() });

    expect(module.getCapability()).toMatchObject({
      actions: ["cue.play"],
      availability: "degraded"
    });
    await module.execute(command("cue.play", {}), { signal });
    expect(playCue).toHaveBeenCalledWith(
      { frequencyHz: 660, durationMs: 140, volume: 0.2 },
      signal
    );
    await expect(
      module.execute(command("cue.play", { frequencyHz: 5_000 }), { signal })
    ).rejects.toThrow();
  });

  it("creates a valid mono PCM WAV cue", () => {
    const wav = createCueWav({ frequencyHz: 660, durationMs: 100, volume: 0.2 });
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.length).toBe(44 + 2_400 * 2);
  });
});
