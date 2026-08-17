import type { Metadata } from "next";

import StreamPanel from "./stream-panel";

export const metadata: Metadata = {
  title: "Stream Appearance",
  description: "Manage whether your Maiks.yt profile can appear in website stream moments."
};

const AccountStreamPage = (): React.ReactNode => <StreamPanel />;

export default AccountStreamPage;
