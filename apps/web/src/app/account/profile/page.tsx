import type { Metadata } from "next";

import ProfilePanel from "./profile-panel";

export const metadata: Metadata = {
  title: "Account Profile",
  description: "Manage your Maiks.yt account name, image, and provider profile choices."
};

const AccountProfilePage = (): React.ReactNode => <ProfilePanel />;

export default AccountProfilePage;
