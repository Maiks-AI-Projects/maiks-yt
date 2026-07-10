import BackupHealthAdminClient from "./backup-health-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Backup Health | Maiks.yt",
  description: "Owner-only backup health view for dev testing readiness."
};

const BackupHealthAdminPage = (): React.ReactNode => (
  <main className="project-admin-page">
    <BackupHealthAdminClient />
  </main>
);

export default BackupHealthAdminPage;
