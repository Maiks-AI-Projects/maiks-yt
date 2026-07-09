import SessionAdminClient from "./session-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Session Admin - Maiks.yt",
  description: "Owner-only session review and revocation."
};

const SessionAdminPage = (): React.ReactNode => (
  <main className="project-admin-page">
    <SessionAdminClient />
  </main>
);

export default SessionAdminPage;
