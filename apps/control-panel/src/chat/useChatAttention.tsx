import type { StreamerChatMessage } from "@maiks-yt/events";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import {
  createChatAttentionReadout,
  createChatAttentionTitle,
  normalizeChatAttentionText,
  shouldAnnounceChatMessage
} from "./chat-attention.service.js";
import type { ChatAttentionPreferences } from "./chat-attention.types.js";
import {
  getAudioOutputStorageKey,
  normalizeAudioOutputLabel,
  parseSavedAudioOutput,
  type SavedAudioOutput
} from "./audio-output.service.js";

const preferencesStorageKey = "maiks.yt.chat.attention.preferences";
const defaultPreferences: ChatAttentionPreferences = {
  cueEnabled: true,
  speechEnabled: true,
  desktopEnabled: false
};

const readPreferences = (): ChatAttentionPreferences => {
  try {
    const stored = window.localStorage.getItem(preferencesStorageKey);
    return stored ? { ...defaultPreferences, ...JSON.parse(stored) as Partial<ChatAttentionPreferences> } : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
};

type SelectableMediaDevices = MediaDevices & {
  selectAudioOutput?: (options?: { deviceId?: string }) => Promise<MediaDeviceInfo>;
};

type SinkSelectableAudioContext = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

const playAttentionCue = async (deviceId: string | null): Promise<void> => {
  const AudioContextClass = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass() as SinkSelectableAudioContext;

  if (deviceId && context.setSinkId) {
    await context.setSinkId(deviceId);
  }
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.frequency.setValueAtTime(740, now);
  oscillator.frequency.exponentialRampToValueAtTime(980, now + 0.12);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.24);
  oscillator.addEventListener("ended", () => void context.close(), { once: true });
};

const speakMessage = (message: StreamerChatMessage): void => {
  if (!("speechSynthesis" in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(createChatAttentionReadout(message));
  utterance.rate = 1.06;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
};

export const useChatAttention = (enabled: boolean): {
  baselineMessages: (messages: readonly StreamerChatMessage[]) => void;
  notifyMessage: (message: StreamerChatMessage) => void;
  controls: ReactNode;
} => {
  const [preferences, setPreferences] = useState<ChatAttentionPreferences>(readPreferences);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestMessage, setLatestMessage] = useState<StreamerChatMessage | null>(null);
  const [status, setStatus] = useState("Listening for new human messages.");
  const audioOutputStorageKey = getAudioOutputStorageKey(window.location.pathname);
  const [audioOutput, setAudioOutput] = useState<SavedAudioOutput | null>(() =>
    parseSavedAudioOutput(window.localStorage.getItem(audioOutputStorageKey))
  );
  const preferencesRef = useRef(preferences);
  const seenMessageIds = useRef(new Set<string>());
  const baselineReady = useRef(false);

  useEffect(() => {
    preferencesRef.current = preferences;
    window.localStorage.setItem(preferencesStorageKey, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    document.title = createChatAttentionTitle(unreadCount);
    return () => {
      document.title = "Maiks.yt Streamer Chat";
    };
  }, [enabled, unreadCount]);

  const deliverAttention = useCallback((message: StreamerChatMessage): void => {
    const currentPreferences = preferencesRef.current;

    if (currentPreferences.cueEnabled) {
      void playAttentionCue(audioOutput?.deviceId ?? null).catch(() => {
        setStatus("Selected cue output is unavailable. Choose it again or use the system output.");
      });
    }

    if (currentPreferences.speechEnabled) {
      speakMessage(message);
    }

    if (currentPreferences.desktopEnabled && "Notification" in window && Notification.permission === "granted") {
      const notification = new Notification(`${message.authorName} · ${message.source}`, {
        body: normalizeChatAttentionText(message.message),
        tag: `maiks-chat-${message.id}`
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }, [audioOutput]);

  const selectAudioOutput = async (): Promise<void> => {
    const mediaDevices = navigator.mediaDevices as SelectableMediaDevices | undefined;

    if (!mediaDevices?.selectAudioOutput) {
      setStatus("This browser cannot select an output inside the PWA. Route the PWA through the system audio mixer or an extension.");
      return;
    }

    try {
      const selected = await mediaDevices.selectAudioOutput(audioOutput
        ? { deviceId: audioOutput.deviceId }
        : undefined);
      const nextOutput = {
        deviceId: selected.deviceId,
        label: normalizeAudioOutputLabel(selected.label)
      } satisfies SavedAudioOutput;
      window.localStorage.setItem(audioOutputStorageKey, JSON.stringify(nextOutput));
      setAudioOutput(nextOutput);
      setStatus(`Cue output set to ${nextOutput.label}. Browser read-aloud still follows the PWA/system route.`);
    } catch (error) {
      setStatus(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Audio output selection was cancelled or not allowed."
        : "Audio output selection failed.");
    }
  };

  const resetAudioOutput = (): void => {
    window.localStorage.removeItem(audioOutputStorageKey);
    setAudioOutput(null);
    setStatus("Cue output reset to the system default.");
  };

  const baselineMessages = useCallback((messages: readonly StreamerChatMessage[]): void => {
    for (const message of messages) {
      seenMessageIds.current.add(message.id);
    }
    baselineReady.current = true;
  }, []);

  const notifyMessage = useCallback((message: StreamerChatMessage): void => {
    if (seenMessageIds.current.has(message.id)) {
      return;
    }

    seenMessageIds.current.add(message.id);
    if (!enabled || !baselineReady.current || !shouldAnnounceChatMessage(message)) {
      return;
    }

    setLatestMessage(message);
    setUnreadCount((current) => current + 1);
    setStatus(`${message.authorName}: ${normalizeChatAttentionText(message.message)}`);
    deliverAttention(message);
  }, [deliverAttention, enabled]);

  const requestDesktopNotifications = async (): Promise<void> => {
    if (!("Notification" in window)) {
      setStatus("Desktop notifications are not available in this browser.");
      return;
    }

    const permission = await Notification.requestPermission();
    const enabled = permission === "granted";
    setPreferences((current) => ({ ...current, desktopEnabled: enabled }));
    setStatus(enabled ? "Desktop notifications enabled." : "Desktop notifications were not allowed.");
  };

  const runTest = (): void => {
    const testMessage: StreamerChatMessage = {
      id: `attention-test-${Date.now()}`,
      authorKind: "human",
      authorName: "Chat attention test",
      createdAt: new Date().toISOString(),
      message: "This is how a new chat message will sound.",
      source: "fake-local",
      visibleOnOverlayByDefault: false
    };
    deliverAttention(testMessage);
    setStatus(createChatAttentionReadout(testMessage));
  };

  const controls = (
    <section className="chat-attention" aria-label="Chat attention controls">
      <div className="chat-attention-summary">
        <strong>{unreadCount > 0 ? `${unreadCount} unread` : "Attention ready"}</strong>
        <span>{status}</span>
      </div>
      <div className="chat-attention-actions">
        <button
          type="button"
          className={preferences.cueEnabled ? "active" : ""}
          onClick={() => setPreferences((current) => ({ ...current, cueEnabled: !current.cueEnabled }))}
        >
          Sound {preferences.cueEnabled ? "on" : "off"}
        </button>
        <button
          type="button"
          className={preferences.speechEnabled ? "active" : ""}
          onClick={() => setPreferences((current) => ({ ...current, speechEnabled: !current.speechEnabled }))}
        >
          Read aloud {preferences.speechEnabled ? "on" : "off"}
        </button>
        <button
          type="button"
          className={preferences.desktopEnabled ? "active" : ""}
          onClick={() => preferences.desktopEnabled
            ? setPreferences((current) => ({ ...current, desktopEnabled: false }))
            : void requestDesktopNotifications()}
        >
          Desktop {preferences.desktopEnabled ? "on" : "off"}
        </button>
        <button type="button" onClick={() => void selectAudioOutput()}>
          Output: {audioOutput?.label ?? "System"}
        </button>
        {audioOutput ? (
          <button type="button" onClick={resetAudioOutput}>Reset output</button>
        ) : null}
        <button type="button" onClick={runTest}>Test</button>
        {latestMessage && preferences.speechEnabled ? (
          <button type="button" onClick={() => speakMessage(latestMessage)}>Read latest</button>
        ) : null}
        {unreadCount > 0 ? (
          <button type="button" onClick={() => setUnreadCount(0)}>Mark read</button>
        ) : null}
      </div>
    </section>
  );

  return { baselineMessages, notifyMessage, controls };
};
