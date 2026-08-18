import ConnectionsWorkspaceClient from "./connections-workspace-client";
import "./connections.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Connections | Maiks.yt",
  description: "Event intake, mechanism health, and safe history inspection."
};

const ConnectionsPage = (): React.ReactNode => (
  <main className="project-admin-page connections-admin-page">
    <header className="connections-page-header">
      <h1>Connections</h1>
      <p>Event intake, mechanism health, and safe history inspection</p>
    </header>

    <ConnectionsWorkspaceClient />
  </main>
);

export default ConnectionsPage;
