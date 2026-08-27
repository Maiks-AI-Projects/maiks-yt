export const controlBaseUrl =
  process.env.NEXT_PUBLIC_CONTROL_BASE_URL ?? "https://control.maiks.yt";
export const overlayBaseUrl =
  process.env.NEXT_PUBLIC_OVERLAY_BASE_URL ?? "https://overlay.maiks.yt";

export const createControlUrl = (path: string): string =>
  new URL(path, controlBaseUrl).toString();
