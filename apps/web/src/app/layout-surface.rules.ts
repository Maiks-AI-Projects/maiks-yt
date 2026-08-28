export type AuthenticatedNavigationContext = "account" | null;

export type LayoutSurface = {
  authenticatedContext: AuthenticatedNavigationContext;
  bodyClassKind: "site" | "tool" | "admin";
  showPublicShell: boolean;
};

const recoveryPath = "/access/recovery";

export const resolveLayoutSurface = (pathname: string): LayoutSurface => {
  const isToolSurface = pathname.startsWith("/tools/");
  const isAdminSurface = pathname === "/admin" || pathname.startsWith("/admin/");
  const isMusicPlayerSurface = pathname === "/music/player";
  const isControlPwaSurface = pathname === "/control" || pathname.startsWith("/control/");
  const isChatPwaSurface = pathname === "/chat";
  const isModerationPwaSurface = pathname === "/moderation" || pathname.startsWith("/moderation/");
  const isStandaloneSurface = isToolSurface
    || isAdminSurface
    || isMusicPlayerSurface
    || isControlPwaSurface
    || isChatPwaSurface
    || isModerationPwaSurface;
  const isRecoverySurface = pathname === recoveryPath;

  return {
    authenticatedContext: !isRecoverySurface && (pathname === "/account" || pathname.startsWith("/account/"))
      ? "account"
      : null,
    bodyClassKind: isAdminSurface ? "admin" : isStandaloneSurface ? "tool" : "site",
    showPublicShell: !isStandaloneSurface
  };
};
