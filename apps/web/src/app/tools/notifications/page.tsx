import type { Metadata } from "next";

import NotificationPanelClient from "./notification-panel-client";

export const metadata: Metadata = {
  title: "Notifications | Maiks.yt Stream Tools",
  description: "Private system notification panel for Maiks.yt dev and operations alerts.",
  applicationName: "Maiks.yt Stream Tools",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Notifications",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: "/icons/maiks-tools-icon.svg",
    apple: "/icons/maiks-tools-icon.svg"
  }
};

const NotificationsToolPage = (): React.ReactNode => (
  <main className="tool-surface-page notification-tool-page">
    <NotificationPanelClient />
  </main>
);

export default NotificationsToolPage;
