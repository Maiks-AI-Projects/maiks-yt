export type SiteSurface = "public" | "admin" | "tool" | "dev";

export type SiteTheme = "default" | "satisfactory";

export type SiteSurfaceClassification = {
  surface: SiteSurface;
  theme: SiteTheme;
  bodyClassName: `${SiteSurface}-surface-body`;
};

const stripPathnameOnly = (pathname: string): string => {
  const queryIndex = pathname.indexOf("?");
  const hashIndex = pathname.indexOf("#");
  const endIndex = [queryIndex, hashIndex]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  return endIndex === undefined ? pathname : pathname.slice(0, endIndex);
};

const classifySiteTheme = (pathnameOnly: string): SiteTheme =>
  pathnameOnly === "/gemini-lab/satisfactory" ? "satisfactory" : "default";

export const classifySiteSurface = (pathname: string): SiteSurfaceClassification => {
  const pathnameOnly = stripPathnameOnly(pathname);
  const theme = classifySiteTheme(pathnameOnly);

  if (pathnameOnly === "/admin" || pathnameOnly.startsWith("/admin/")) {
    return {
      surface: "admin",
      theme,
      bodyClassName: "admin-surface-body"
    };
  }

  if (pathnameOnly.startsWith("/tools/")) {
    return {
      surface: "tool",
      theme,
      bodyClassName: "tool-surface-body"
    };
  }

  if (pathnameOnly.startsWith("/dev/")) {
    return {
      surface: "dev",
      theme,
      bodyClassName: "dev-surface-body"
    };
  }

  return {
    surface: "public",
    theme,
    bodyClassName: "public-surface-body"
  };
};
