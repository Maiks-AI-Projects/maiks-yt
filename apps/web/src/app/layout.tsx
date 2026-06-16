import "./globals.css";

import { headers } from "next/headers";

import OAuthLoginPanel from "./oauth-login-panel";

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
  const isToolSurface = pathname.startsWith("/tools/");

  return (
    <html lang="en">
      <body className={isToolSurface ? "tool-surface-body" : undefined}>
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
