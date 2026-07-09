import MoneyAdminClient from "./money-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Money Ledger | Maiks.yt",
  description: "Owner-only private money ledger entry and review."
};

const MoneyAdminPage = (): React.ReactNode => (
  <main className="project-admin-page money-admin-page">
    <MoneyAdminClient />
  </main>
);

export default MoneyAdminPage;
