import "./globals.css";
import "./visual-system.css";
import "./admin-visual-system.css";

import { headers } from "next/headers";

import OAuthLoginPanel from "./oauth-login-panel";
import { classifySiteSurface } from "./site-surface.service";

export const metadata = {
  title: {
    default: "Maiks.yt — streams, projects, and community",
    template: "%s | Maiks.yt"
  },
  description: "Michael's independent home for streams, projects, public updates, and community tools."
};

type RootLayoutProps = {
  children: React.ReactNode;
};

const RootLayout = async ({ children }: RootLayoutProps): Promise<React.ReactNode> => {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-maiks-pathname") ?? "";
  const siteSurface = classifySiteSurface(pathname);
  const isToolSurface = siteSurface.surface === "tool";
  const isAdminSurface = siteSurface.surface === "admin";
  const isDevSurface = siteSurface.surface === "dev";
  const primaryLinks = [
    ["/schedule", "Schedule"],
    ["/projects", "Projects"],
    ["/updates", "Updates"],
    ["/games", "Games"],
    ["/links", "All links"]
  ] as const;

  return (
    <html lang="en">
      <body
        className={siteSurface.bodyClassName}
        data-site-surface={siteSurface.surface}
        data-site-theme={siteSurface.theme}
      >
        {isToolSurface ? null : (
          <header className="site-header">
            <nav aria-label="Primary" className="site-nav">
              <a className="site-brand" href="/" aria-label="Maiks.yt home">
                <span className="site-brand-mark" aria-hidden="true">M</span>
                <span className="site-brand-copy">
                  <strong>Maiks.yt</strong>
                  <small>Creator studio</small>
                </span>
              </a>
              <div className="site-links">
                {primaryLinks.map(([href, label]) => (
                  <a href={href} aria-current={pathname === href ? "page" : undefined} key={href}>{label}</a>
                ))}
              </div>
            </nav>
            <div className="site-utility">
              {isAdminSurface || isDevSurface ? <span className="environment-badge">Dev workspace</span> : null}
              <OAuthLoginPanel variant="nav" />
            </div>
          </header>
        )}
        {children}
        {isToolSurface ? null : (
          <footer className="site-footer">
            <div>
              <strong>Maiks.yt</strong>
              <span>One independent home for the stream and the work around it.</span>
            </div>
            <nav aria-label="Footer">
              <a href="/context">Context</a>
              <a href="/accountability">Accountability</a>
              <a href="/community-rules">Community rules</a>
              <a href="/privacy/analytics">Privacy</a>
              <a href="/account">Account</a>
            </nav>
          </footer>
        )}
      </body>
    </html>
  );
};

export default RootLayout;
