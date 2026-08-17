import type { Metadata } from "next";

import PrivacyPanel from "./privacy-panel";

export const metadata: Metadata = {
  title: "Account Privacy",
  description: "Manage your Maiks.yt profile visibility."
};

const AccountPrivacyPage = (): React.ReactNode => <PrivacyPanel />;

export default AccountPrivacyPage;
