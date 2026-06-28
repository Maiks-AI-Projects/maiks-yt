import type { EventKind } from "./event-registry.types.js";

export const streamVisibilityGlobalPreferenceScope = "all_stream_visible_website_events" as const;

export const streamVisibilityEventPreferenceScopes = [
  "website.signup",
  "website.username-change",
  "website.profile-image-update",
  "website.free-tts-request"
] as const satisfies readonly EventKind[];

export const streamVisibilityPreferenceScopes = [
  streamVisibilityGlobalPreferenceScope,
  ...streamVisibilityEventPreferenceScopes
] as const;

export type StreamVisibilityGlobalPreferenceScope = typeof streamVisibilityGlobalPreferenceScope;
export type StreamVisibilityEventPreferenceScope = typeof streamVisibilityEventPreferenceScopes[number];
export type StreamVisibilityPreferenceScope = typeof streamVisibilityPreferenceScopes[number];

export type StreamVisibilityPreferenceDefinition = {
  scope: StreamVisibilityPreferenceScope;
  label: string;
  description: string;
};

export type StreamVisibilityPreferenceValue = StreamVisibilityPreferenceDefinition & {
  optedOut: boolean;
};

