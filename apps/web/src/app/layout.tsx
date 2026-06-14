import "./globals.css";

import OAuthLoginPanel from "./oauth-login-panel";

export const metadata = {
  title: "Maiks.yt",
  description: "V2 stream and community platform foundation"
};

type RootLayoutProps = {
  children: React.ReactNode;
};

const RootLayout = ({ children }: RootLayoutProps): React.ReactNode => (
  <html lang="en">
    <body>
      <header className="site-header">
        <nav aria-label="Primary" className="site-nav">
          <a className="site-brand" href="/">Maiks.yt</a>
          <div className="site-links">
            <a href="/links">Links</a>
            <a href="/updates">Updates</a>
            <a href="/account">Account</a>
            <a href="/gemini-lab">Layout Lab</a>
          </div>
        </nav>
        <OAuthLoginPanel variant="nav" />
      </header>
      {children}
    </body>
  </html>
);

export default RootLayout;
