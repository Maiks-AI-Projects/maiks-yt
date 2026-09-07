import PublicUpdateAdminClient from "./public-update-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Updates | Maiks.yt",
  description: "Owner-only public update publishing."
};

const PublicUpdateAdminPage = (): React.ReactNode => (
  <main className="project-admin-page">
    <PublicUpdateAdminClient />
  </main>
);

export default PublicUpdateAdminPage;
