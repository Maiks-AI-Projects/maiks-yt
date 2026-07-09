import AdminDashboardClient from "./admin-dashboard-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Dashboard - Maiks.yt",
  description: "Private admin dashboard for Maiks.yt testing and operations."
};

const AdminDashboardPage = (): React.ReactNode => (
  <main className="project-admin-page">
    <AdminDashboardClient />
  </main>
);

export default AdminDashboardPage;
