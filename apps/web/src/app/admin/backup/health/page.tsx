import BackupHealthAdminClient from "./backup-health-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Backup Health | Maiks.yt",
  description: "Owner-only source-table and dump-tool health check."
};

const BackupHealthAdminPage = (): React.ReactNode => (
  <main className="project-admin-page">
    <BackupHealthAdminClient />
  </main>
);

export default BackupHealthAdminPage;
