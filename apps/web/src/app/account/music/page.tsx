import type { Metadata } from "next";

import AccountMusicClient from "./account-music-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Music Top 10",
  description: "Manage your Maiks.yt music Top 10."
};

const AccountMusicPage = (): React.ReactNode => <AccountMusicClient />;

export default AccountMusicPage;
