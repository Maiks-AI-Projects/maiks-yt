import ActionPanelClient from "../../actions/action-panel-client";

type ToolActionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = {
  title: "Action Panel App | Maiks.yt",
  description: "Standalone approval inbox for stream and admin decisions."
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

