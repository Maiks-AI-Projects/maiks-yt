export type OverlayThemeSurface = "website" | "overlay" | "control-panel";

export type OverlayLayoutSlot =
  | "game"
  | "camera"
  | "chat"
  | "sponsor-primary"
  | "sponsor-secondary"
  | "notification-top"
  | "notification-center"
  | "stream-goal";

export type ThemeManifest = {
  id: string;
  label: string;
  cssFile: string;
  surfaces: readonly OverlayThemeSurface[];
  requiredVariables: readonly string[];
  supportedSlots: readonly OverlayLayoutSlot[];
};

export const requiredThemeVariables = [
  "--maiks-bg",
  "--maiks-fg",
  "--maiks-muted",
  "--maiks-panel",
  "--maiks-accent",
  "--maiks-danger",
  "--maiks-warning",
  "--maiks-success",
  "--maiks-notification-bg",
  "--maiks-notification-fg"
] as const;

export const defaultTheme: ThemeManifest = {
  id: "default",
  label: "Default",
  cssFile: "default.css",
  surfaces: ["website", "overlay", "control-panel"],
  requiredVariables: requiredThemeVariables,
  supportedSlots: [
    "game",
    "camera",
    "chat",
    "sponsor-primary",
    "sponsor-secondary",
    "notification-top",
    "notification-center",
    "stream-goal"
  ]
};
