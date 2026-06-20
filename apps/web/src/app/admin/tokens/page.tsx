import TokenAdminClient from "./token-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Token Admin | Maiks.yt",
  description: "Owner-only scoped URL token management."
};

const TokenAdminPage = (): React.ReactNode => (
  <main className="project-admin-page token-admin-page">
    <TokenAdminClient />
  </main>
);

export default TokenAdminPage;
