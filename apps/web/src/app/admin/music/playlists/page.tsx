import type { Metadata } from "next";

import AdminMusicPlaylistsClient from "./admin-music-playlists-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Music Playlists Admin | Maiks.yt",
  description: "Music playlist operations."
};

const AdminMusicPlaylistsPage = (): React.ReactNode => (
  <main className="project-admin-page">
    <AdminMusicPlaylistsClient />
  </main>
);

export default AdminMusicPlaylistsPage;
