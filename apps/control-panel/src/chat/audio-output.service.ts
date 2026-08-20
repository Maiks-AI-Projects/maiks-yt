export type SavedAudioOutput = {
  deviceId: string;
  label: string;
};

const audioOutputStoragePrefix = "maiks.yt.audio-output";

export const getAudioOutputStorageKey = (pathname: string): string => {
  const surface = pathname === "/moderation"
    ? "moderation"
    : pathname === "/chat"
      ? "chat"
      : "control";

  return `${audioOutputStoragePrefix}.${surface}`;
};

export const normalizeAudioOutputLabel = (label: string): string =>
  label.replace(/\s+/g, " ").trim().slice(0, 120) || "Selected output";

export const parseSavedAudioOutput = (value: string | null): SavedAudioOutput | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<SavedAudioOutput>;
    const deviceId = typeof parsed.deviceId === "string" ? parsed.deviceId.trim() : "";

    if (!deviceId) {
      return null;
    }

    return {
      deviceId,
      label: normalizeAudioOutputLabel(typeof parsed.label === "string" ? parsed.label : "")
    };
  } catch {
    return null;
  }
};
