export type DeviceSummary = {
  label: string;
  mobile: boolean;
};

export const formatSessionDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

export const formatSessionActivity = (value: string): string => {
  const elapsedMilliseconds = Date.now() - Date.parse(value);

  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds < 0) {
    return formatSessionDate(value);
  }

  const elapsedMinutes = Math.floor(elapsedMilliseconds / 60_000);

  if (elapsedMinutes < 2) return "Active now";
  if (elapsedMinutes < 60) return `${elapsedMinutes} minutes ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;

  return formatSessionDate(value);
};

export const getDeviceSummary = (userAgent: string | null): DeviceSummary => {
  if (!userAgent) return { label: "Unknown device", mobile: false };

  const mobile = /Android|iPhone|iPad|Mobile/i.test(userAgent);
  const system = /iPhone/i.test(userAgent)
    ? "iPhone"
    : /iPad/i.test(userAgent)
      ? "iPad"
      : /Android/i.test(userAgent)
        ? "Android"
        : /Windows/i.test(userAgent)
          ? "Windows"
          : /CrOS/i.test(userAgent)
            ? "ChromeOS"
            : /Mac OS X|Macintosh/i.test(userAgent)
              ? "macOS"
              : /Linux/i.test(userAgent)
                ? "Linux"
                : "Unknown system";

  const browserMatch = userAgent.match(/Edg(?:A|iOS)?\/(\d+)/i)
    ?? userAgent.match(/CriOS\/(\d+)/i)
    ?? userAgent.match(/Chrome\/(\d+)/i)
    ?? userAgent.match(/FxiOS\/(\d+)/i)
    ?? userAgent.match(/Firefox\/(\d+)/i)
    ?? userAgent.match(/Version\/(\d+).+Safari/i);
  const browser = /Edg(?:A|iOS)?\//i.test(userAgent)
    ? "Edge"
    : /CriOS\/|Chrome\//i.test(userAgent)
      ? "Chrome"
      : /FxiOS\/|Firefox\//i.test(userAgent)
        ? "Firefox"
        : /Safari\//i.test(userAgent)
          ? "Safari"
          : "Unknown browser";

  return {
    label: `${browser}${browserMatch?.[1] ? ` ${browserMatch[1]}` : ""} · ${system}`,
    mobile
  };
};
