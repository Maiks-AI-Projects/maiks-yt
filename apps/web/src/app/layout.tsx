import "./globals.css";

import { headers } from "next/headers";

import OAuthLoginPanel from "./oauth-login-panel";
import { AuthenticatedNavigation } from "./authenticated-navigation";
import { SiteNavigation } from "./site-navigation";
import shellStyles from "./site-shell.module.css";

export const metadata = {
  title: {
    default: "Maiks.yt",
    template: "%s | Maiks.yt"
  },
  description: "Michael's independent home for streams, projects, and community."
};

type RootLayoutProps = {
  children: React.ReactNode;
};

const RootLayout = async ({ children }: RootLayoutProps): Promise<React.ReactNode> => {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-maiks-pathname") ?? "";
  const isToolSurface = pathname.startsWith("/tools/");
  const authenticatedContext = pathname === "/account"
    ? "account"
    : pathname === "/admin" || pathname.startsWith("/admin/")
      ? "admin"
      : null;

  return (
    <html lang="en">
      <body className={isToolSurface ? "tool-surface-body" : shellStyles.siteBody}>
        {isToolSurface ? null : (
          <>
            <a className={shellStyles.skipLink} href="#main-content">Skip to content</a>
            <header className={shellStyles.header}>
              <div className={shellStyles.navShell}>
                <a className={shellStyles.brand} href="/" aria-label="Maiks.yt home">
                  <span className={shellStyles.brandMark} aria-hidden="true">M</span>
                  <strong>Maiks.yt</strong>
                </a>
                <SiteNavigation />
                <div className={shellStyles.account}>
                  <OAuthLoginPanel variant="nav" />
                </div>
              </div>
            </header>
            {authenticatedContext ? <AuthenticatedNavigation context={authenticatedContext} /> : null}
          </>
        )}
        <div className={isToolSurface ? undefined : shellStyles.mainContent} id="main-content">{children}</div>
        {isToolSurface ? null : (
          <footer className={shellStyles.footer}>
            <div className={shellStyles.footerInner}>
              <div className={shellStyles.footerBrand}>
                <strong>Maiks.yt</strong>
                <span>Michael's independent home for streams and the work around them.</span>
              </div>
              <nav className={shellStyles.footerLinks} aria-label="Footer navigation">
                <a href="/progress">Build progress</a>
                <a href="/about">About Michael</a>
                <a href="/community-rules">Community rules</a>
                <a href="/accountability">Accountability</a>
                <a href="/privacy/analytics">Privacy</a>
              </nav>
            </div>
          </footer>
        )}
      </body>
    </html>
  );
};

export default RootLayout;
