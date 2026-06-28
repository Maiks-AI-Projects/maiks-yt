import ModeratorAdminClient from "./moderator-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Moderator Admin | Maiks.yt",
  description: "Owner-gated helper and moderator role management."
};

const ModeratorAdminPage = (): React.ReactNode => (
  <main className="project-admin-page moderator-admin-page">
    <ModeratorAdminClient />
  </main>
);

export default ModeratorAdminPage;
