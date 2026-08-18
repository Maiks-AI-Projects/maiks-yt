import type { Metadata } from "next";

import AdminMusicReviewClient from "./admin-music-review-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Music Review Admin | Maiks.yt",
  description: "Music review queue and blacklist operations."
};

const AdminMusicReviewPage = (): React.ReactNode => (
  <main className="project-admin-page">
    <AdminMusicReviewClient />
  </main>
);

export default AdminMusicReviewPage;
