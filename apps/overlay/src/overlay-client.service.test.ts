import { describe, expect, it, vi } from "vitest";

import {
  getPlayableNotificationSound,
  playNotificationSoundOnce,
  type SoundPlayableNotification
} from "./overlay-client.service.js";

const notification = (overrides: Partial<SoundPlayableNotification> = {}): SoundPlayableNotification => ({
  id: "event-1",
  sound: {
    url: "/event-sounds/02-standard-alerts/follow-creaky-door.wav",
    volume: 0.28
  },
  ...overrides
});

describe("overlay notification sound playback", () => {
  it("plays top notification sounds once per event id at the configured conservative volume", () => {
    const playedIds = new Set<string>();
    const play = vi.fn().mockResolvedValue(undefined);
    const created: Array<{ url: string; volume: number; play: typeof play }> = [];
    const createAudio = (url: string) => {
      const audio = {
        url,
        volume: 1,
        play
      };
      created.push(audio);
      return audio;
    };

    expect(playNotificationSoundOnce(notification(), playedIds, createAudio)).toBe(true);
    expect(playNotificationSoundOnce(notification(), playedIds, createAudio)).toBe(false);

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      url: "/event-sounds/02-standard-alerts/follow-creaky-door.wav",
      volume: 0.28
    });
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("dedupes center playback before the same event is promoted to the top bar", () => {
    const playedIds = new Set<string>();
    const play = vi.fn().mockResolvedValue(undefined);
    const createAudio = (url: string) => ({
      volume: 1,
      play,
      url
    });
    const centerNotification: SoundPlayableNotification = {
      id: "event-1",
      center: {
        sound: {
          url: "/event-sounds/03-big-events/raid-broken-radio.wav",
          volume: 0.28
        }
      }
    };
    const promotedTopNotification = notification({
      id: centerNotification.id,
      sound: {
        url: "/event-sounds/03-big-events/raid-broken-radio.wav",
        volume: 0.28
      }
    });

    expect(playNotificationSoundOnce(centerNotification, playedIds, createAudio)).toBe(true);
    expect(playNotificationSoundOnce(promotedTopNotification, playedIds, createAudio)).toBe(false);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("keeps no-sound notifications silent and supports the legacy center audio field", () => {
    expect(getPlayableNotificationSound({ id: "event-1" })).toBeNull();
    expect(getPlayableNotificationSound({
      id: "event-1",
      center: {
        audioUrl: "/legacy-center.wav"
      }
    })).toEqual({
      url: "/legacy-center.wav",
      volume: 0.28
    });
  });
});
