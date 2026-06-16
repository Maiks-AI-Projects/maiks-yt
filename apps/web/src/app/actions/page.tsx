import ActionPanelClient from "./action-panel-client";

type ActionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const getSingleParam = (value: string | string[] | undefined): string | null => {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
};

const ActionsPage = async ({ searchParams }: ActionsPageProps): Promise<React.ReactNode> => {
  const resolvedSearchParams = await searchParams;
  const liveMode = getSingleParam(resolvedSearchParams.live) === "1";

  return (
    <main className="actions-page">
      <ActionPanelClient liveMode={liveMode} />
    </main>
  );
};

export default ActionsPage;
