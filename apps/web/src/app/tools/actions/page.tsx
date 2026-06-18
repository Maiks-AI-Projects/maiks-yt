import type { Metadata } from "next";

import ActionPanelClient from "../../actions/action-panel-client";

type ToolActionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Action Panel App | Maiks.yt",
  description: "Standalone approval inbox for stream and admin decisions.",
  applicationName: "Maiks.yt Stream Tools",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Action Panel",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: "/icons/maiks-tools-icon.svg",
    apple: "/icons/maiks-tools-icon.svg"
  }
};

const getSingleParam = (value: string | string[] | undefined): string | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

const ToolActionsPage = async ({ searchParams }: ToolActionsPageProps): Promise<React.ReactNode> => {
  const resolvedSearchParams = await searchParams;
  const liveMode = getSingleParam(resolvedSearchParams.live) === "1";

  return (
    <main className="actions-page tool-surface-page">
      <ActionPanelClient liveMode={liveMode} hrefBase="/tools/actions" compact />
    </main>
  );
};

export default ToolActionsPage;
