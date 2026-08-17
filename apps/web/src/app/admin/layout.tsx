import AdminShell from "./admin-shell";

type AdminLayoutProps = {
  children: React.ReactNode;
};

const AdminLayout = ({ children }: AdminLayoutProps): React.ReactNode => (
  <AdminShell>{children}</AdminShell>
);

export default AdminLayout;
