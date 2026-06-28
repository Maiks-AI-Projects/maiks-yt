import LiveHelperDashboardClient from "./live-helper-dashboard-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Live Helper Dashboard | Maiks.yt",
  description: "Read-only live helper monitoring dashboard."
};

const LiveHelperDashboardPage = (): React.ReactNode => (
  <main className="project-admin-page live-helper-page">
    <LiveHelperDashboardClient />
  </main>
);

export default LiveHelperDashboardPage;
