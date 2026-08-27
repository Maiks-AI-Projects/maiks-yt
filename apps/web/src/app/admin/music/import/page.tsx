import type { Metadata } from "next";

import AdminMusicImportClient from "./admin-music-import-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Music Import Admin | Maiks.yt",
  description: "Owner-only YouTube Audio Library manifest import."
};

const AdminMusicImportPage = (): React.ReactNode => (
  <main className="project-admin-page">
    <AdminMusicImportClient />
  </main>
);

export default AdminMusicImportPage;
