import "./globals.css";

import Image from "next/image";
import { headers } from "next/headers";
import type { Metadata } from "next";

import OAuthLoginPanel from "./oauth-login-panel";
import { AuthenticatedNavigation } from "./authenticated-navigation";
import { resolveLayoutSurface } from "./layout-surface.rules";
import { SiteNavigation } from "./site-navigation";
import shellStyles from "./site-shell.module.css";

export const metadata: Metadata = {
  title: {
    default: "Maiks.yt",
    template: "%s | Maiks.yt"
  },
  description: "Michael's independent home for streams, projects, and community.",
  icons: {
    icon: [
      { url: "/brand/favicon.ico", type: "image/x-icon" },
      { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" }
    ],
    apple: {
      url: "/brand/apple-touch-icon-180.png",
      sizes: "180x180",
      type: "image/png"
    }
  }
};

type RootLayoutProps = {
  children: React.ReactNode;
};

const RootLayout = async ({ children }: RootLayoutProps): Promise<React.ReactNode> => {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-maiks-pathname") ?? "";
  const layoutSurface = resolveLayoutSurface(pathname);
  const bodyClassName = layoutSurface.bodyClassKind === "admin"
    ? "admin-surface-body"
    : layoutSurface.bodyClassKind === "tool"
      ? "tool-surface-body"
      : shellStyles.siteBody;

  return (
    <html lang="en">
      <body className={bodyClassName}>
        {layoutSurface.showPublicShell ? (
          <>
            <a className={shellStyles.skipLink} href="#main-content">Skip to content</a>
            <header className={shellStyles.header}>
              <div className={shellStyles.navShell}>
                <a className={shellStyles.brand} href="/" aria-label="Maiks.yt home">
                  <Image
                    alt=""
                    aria-hidden="true"
                    className={shellStyles.brandMark}
                    height={34}
                    priority
                    src="/brand/icon-64.png"
                    width={34}
                  />
                  <strong>Maiks.yt</strong>
                </a>
                <SiteNavigation />
                <div className={shellStyles.account}>
                  <OAuthLoginPanel variant="nav" />
                </div>
              </div>
            </header>
            {layoutSurface.authenticatedContext ? <AuthenticatedNavigation context={layoutSurface.authenticatedContext} /> : null}
          </>
        ) : null}
        <div className={layoutSurface.showPublicShell ? shellStyles.mainContent : undefined} id="main-content">{children}</div>
        {layoutSurface.showPublicShell ? (
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
        ) : null}
      </body>
    </html>
  );
};

export default RootLayout;
