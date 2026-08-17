import type { Metadata } from "next";

import ConnectionsPanel from "./connections-panel";

export const metadata: Metadata = {
  title: "Account Connections",
  description: "Manage linked Google, GitHub, Discord, and Twitch sign-in accounts."
};

const AccountConnectionsPage = (): React.ReactNode => <ConnectionsPanel />;

export default AccountConnectionsPage;
