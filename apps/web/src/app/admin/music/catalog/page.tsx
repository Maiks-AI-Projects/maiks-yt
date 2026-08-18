import type { Metadata } from "next";

import AdminMusicCatalogClient from "./admin-music-catalog-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Music Catalog Admin | Maiks.yt",
  description: "Provider policy, track, source, and license authoring."
};

const AdminMusicCatalogPage = (): React.ReactNode => (
  <main className="project-admin-page">
    <AdminMusicCatalogClient />
  </main>
);

export default AdminMusicCatalogPage;
