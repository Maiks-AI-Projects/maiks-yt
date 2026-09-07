import "./globals.css";

import { headers } from "next/headers";

import OAuthLoginPanel from "./oauth-login-panel";
import { classifySiteSurface } from "./site-surface";

export const metadata = {
  title: "Maiks.yt",
  description: "V2 stream and community platform foundation"
};

type RootLayoutProps = {
  children: React.ReactNode;
};

const RootLayout = async ({ children }: RootLayoutProps): Promise<React.ReactNode> => {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-maiks-pathname") ?? "";
  const siteSurface = classifySiteSurface(pathname);
  const isToolSurface = siteSurface.surface === "tool";

  return (
    <html lang="en">
      <body
        className={isToolSurface ? "tool-surface-body" : undefined}
        data-site-surface={siteSurface.surface}
        data-site-theme={siteSurface.theme}
      >
        {isToolSurface ? null : (
          <header className="site-header">
            <nav aria-label="Primary" className="site-nav">
              <a className="site-brand" href="/">Maiks.yt</a>
              <div className="site-links">
                <a href="/links">Links</a>
                <a href="/updates">Updates</a>
                <a href="/privacy/analytics">Privacy</a>
                <a href="/actions">Actions</a>
                <a href="/tools/actions">Action App</a>
                <a href="/account">Account</a>
                <a href="/gemini-lab">Layout Lab</a>
              </div>
            </nav>
            <OAuthLoginPanel variant="nav" />
          </header>
        )}
        {children}
      </body>
    </html>
  );
};

export default RootLayout;
