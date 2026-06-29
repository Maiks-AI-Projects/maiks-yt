import ProviderIntegrationsStatusClient from "./provider-integrations-status-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Provider Integrations | Maiks.yt",
  description: "Owner-only provider integration status."
};

const ProviderIntegrationsPage = (): React.ReactNode => (
  <main className="project-admin-page provider-integrations-page">
    <ProviderIntegrationsStatusClient />
  </main>
);

export default ProviderIntegrationsPage;
