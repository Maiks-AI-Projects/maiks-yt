import CreatorLinkAdminClient from "./creator-link-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Creator Link Admin | Maiks.yt",
  description: "Owner-only Creator Hub link management."
};

const CreatorLinkAdminPage = (): React.ReactNode => (
  <main className="project-admin-page link-admin-page">
    <CreatorLinkAdminClient />
  </main>
);

export default CreatorLinkAdminPage;
