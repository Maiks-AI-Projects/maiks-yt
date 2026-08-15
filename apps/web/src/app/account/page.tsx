import type { Metadata } from "next";

import AccountPanel from "./account-panel";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your Maiks.yt identity, connected accounts, and stream visibility."
};

const AccountPage = (): React.ReactNode => <AccountPanel />;

export default AccountPage;
