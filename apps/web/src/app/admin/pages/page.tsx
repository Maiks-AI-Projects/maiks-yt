import ContentPageAdminClient from "./page-creator-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Page Creator | Maiks.yt",
  description: "Owner-only manual page creator for path-owned website pages."
};

const ContentPageAdminPage = (): React.ReactNode => (
  <main className="project-admin-page page-creator-admin-page">
    <ContentPageAdminClient />
  </main>
);

export default ContentPageAdminPage;
