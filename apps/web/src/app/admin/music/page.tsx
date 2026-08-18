import type { Metadata } from "next";

import AdminMusicOverviewClient from "./admin-music-overview-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Music Admin | Maiks.yt",
  description: "Owner-only music catalog and request operations."
};

const AdminMusicPage = (): React.ReactNode => (
  <main className="project-admin-page">
    <AdminMusicOverviewClient />
  </main>
);

export default AdminMusicPage;
