export const formatMusicPreviewTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export const canSeekMusicPreview = (duration: number): boolean =>
  Number.isFinite(duration) && duration > 0;

export const normalizeMusicPreviewUrl = (url: string | null | undefined): string | null => {
  const normalized = url?.trim() ?? "";

  return normalized.length > 0 ? normalized : null;
};

export const shouldResetMusicPreviewForSourceChange = (
  previousUrl: string | null | undefined,
  nextUrl: string | null | undefined
): boolean => normalizeMusicPreviewUrl(previousUrl) !== normalizeMusicPreviewUrl(nextUrl);
