import {
  streamVisibilityPreferenceScopes,
  type StreamVisibilityPreferenceDefinition,
  type StreamVisibilityPreferenceScope,
  type StreamVisibilityPreferenceValue
} from "./event-stream-visibility-preferences.types.js";

const streamVisibilityPreferenceScopeSet = new Set<string>(streamVisibilityPreferenceScopes);

export const streamVisibilityPreferenceDefinitions = [
  {
    scope: "all_stream_visible_website_events",
    label: "All website/community moments",
    description: "Hide your website and community activity from stream-visible notifications."
  },
  {
    scope: "website.signup",
    label: "Website signup",
    description: "Hide account signup moments from stream-visible website notifications."
  },
  {
    scope: "website.username-change",
    label: "Public name changes",
    description: "Hide public display-name changes from stream-visible website notifications."
  },
  {
    scope: "website.profile-image-update",
    label: "Profile image updates",
    description: "Hide profile image updates from stream-visible website notifications."
  },
  {
    scope: "website.free-tts-request",
    label: "Free website TTS",
    description: "Hide future free website TTS requests from stream-visible playback."
  }
] as const satisfies readonly StreamVisibilityPreferenceDefinition[];

export const isStreamVisibilityPreferenceScope = (
  value: unknown
): value is StreamVisibilityPreferenceScope =>
  typeof value === "string" && streamVisibilityPreferenceScopeSet.has(value);

export const buildStreamVisibilityPreferenceValues = (
  savedPreferences: readonly {
    scope: StreamVisibilityPreferenceScope;
    optedOut: boolean;
  }[]
): readonly StreamVisibilityPreferenceValue[] => {
  const savedByScope = new Map<StreamVisibilityPreferenceScope, boolean>(
    savedPreferences.map((preference) => [preference.scope, preference.optedOut])
  );

  return streamVisibilityPreferenceDefinitions.map((definition) => ({
    ...definition,
    optedOut: savedByScope.get(definition.scope) ?? false
  }));
};

