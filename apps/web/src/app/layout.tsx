import "./globals.css";

export const metadata = {
  title: "Maiks.yt",
  description: "V2 stream and community platform foundation"
};

type RootLayoutProps = {
  children: React.ReactNode;
};

const RootLayout = ({ children }: RootLayoutProps): React.ReactNode => (
  <html lang="en">
    <body>{children}</body>
  </html>
);

export default RootLayout;
