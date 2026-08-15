import AdminDashboardClient from "./admin-dashboard-client";

import styles from "./admin-dashboard.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Dashboard - Maiks.yt",
  description: "Private admin dashboard for Maiks.yt testing and operations."
};

const AdminDashboardPage = (): React.ReactNode => (
  <main className={styles.pageShell}>
    <AdminDashboardClient />
  </main>
);

export default AdminDashboardPage;
