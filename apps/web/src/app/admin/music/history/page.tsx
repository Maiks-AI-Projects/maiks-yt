import type { Metadata } from "next";

import AdminMusicHistoryClient from "./admin-music-history-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Music History Admin | Maiks.yt",
  description: "Recent music playback history."
};

const AdminMusicHistoryPage = (): React.ReactNode => (
  <main className="project-admin-page">
    <AdminMusicHistoryClient />
  </main>
);

export default AdminMusicHistoryPage;
