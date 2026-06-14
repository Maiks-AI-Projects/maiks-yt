import {
  sortActionItemsForContext,
  type ActionItem,
  type ActionItemStatus
} from "@maiks-yt/domain/actions";

type ActionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const initialActions: readonly ActionItem[] = [
  {
    id: "center-alert-review",
    title: "Review center alert",
    description: "Approve a high-priority overlay alert before it can appear center screen.",
    category: "overlay",
    decisionKind: "approve-or-reject",
    priority: "high",
    status: "open",
    streamRelevant: true,
    liveSafe: true,
    createdAt: "2026-06-14T08:30:00.000Z"
  },
  {
    id: "project-update-review",
    title: "Review project update",
    description: "Check a public project update before it is published to the updates feed.",
    category: "project",
    decisionKind: "approve-or-reject",
    priority: "normal",
    status: "open",
    streamRelevant: false,
    liveSafe: false,
    createdAt: "2026-06-14T08:15:00.000Z"
  },
  {
    id: "sponsor-copy-review",
    title: "Review sponsor copy",
    description: "Confirm the message is acceptable before it can be used in an overlay slot.",
    category: "sponsor",
    decisionKind: "review",
    priority: "normal",
    status: "deferred",
    streamRelevant: true,
    liveSafe: true,
    createdAt: "2026-06-14T08:45:00.000Z",
    dueAt: "2026-06-14T12:00:00.000Z"
  }
];

const actionStatusLabels = {
  approved: "Approved",
  completed: "Completed",
  deferred: "Deferred",
  open: "Open",
  rejected: "Rejected"
} satisfies Record<ActionItemStatus, string>;

const mutableActionStatuses = new Set<ActionItemStatus>(["approved", "deferred", "rejected"]);

const getSingleParam = (value: string | string[] | undefined): string | null => {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
};

const getActionStatusOverrides = (value: string | string[] | undefined): Map<string, ActionItemStatus> => {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const overrides = new Map<string, ActionItemStatus>();

  for (const rawValue of rawValues) {
    const [id, status] = rawValue.split(":");

    if (id && mutableActionStatuses.has(status as ActionItemStatus)) {
      overrides.set(id, status as ActionItemStatus);
    }
  }

  return overrides;
};

const createActionHref = (
  searchParams: Record<string, string | string[] | undefined>,
  actionId: string,
  status: ActionItemStatus
): string => {
  const params = new URLSearchParams();
  const live = getSingleParam(searchParams.live);

  if (live === "1") {
    params.set("live", "1");
  }

  for (const [id, currentStatus] of getActionStatusOverrides(searchParams.action)) {
    if (id !== actionId) {
      params.append("action", `${id}:${currentStatus}`);
    }
  }

  params.append("action", `${actionId}:${status}`);

  return `/actions?${params.toString()}`;
};

const createLiveModeHref = (
  searchParams: Record<string, string | string[] | undefined>,
  liveMode: boolean
): string => {
  const params = new URLSearchParams();

  if (!liveMode) {
    params.set("live", "1");
  }

  for (const [id, status] of getActionStatusOverrides(searchParams.action)) {
    params.append("action", `${id}:${status}`);
  }

  const query = params.toString();

  return query ? `/actions?${query}` : "/actions";
};

const ActionsPage = async ({ searchParams }: ActionsPageProps): Promise<React.ReactNode> => {
  const resolvedSearchParams = await searchParams;
  const liveMode = getSingleParam(resolvedSearchParams.live) === "1";
  const overrides = getActionStatusOverrides(resolvedSearchParams.action);
  const actions = initialActions.map((action) => ({
    ...action,
    status: overrides.get(action.id) ?? action.status
  }));
  const sortedActions = sortActionItemsForContext(actions, {
    live: liveMode,
    now: new Date().toISOString()
  });

  return (
    <main className="actions-page">
      <header className="links-header">
        <p className="eyebrow">Action Panel</p>
        <h1>Approval Inbox</h1>
        <p>Review urgent stream-safe actions separately from slower admin work.</p>
      </header>
      <section className="action-panel">
        <div className="action-panel-toolbar">
          <a
            className={`toggle-action ${liveMode ? "enabled" : ""}`}
            href={createLiveModeHref(resolvedSearchParams, liveMode)}
          >
            {liveMode ? "Live-safe view on" : "Live-safe view off"}
          </a>
          <span>{sortedActions.length} visible action(s)</span>
        </div>
        <div className="action-list">
          {sortedActions.map((action) => (
            <article className="action-item-card" key={action.id}>
              <div className="action-item-heading">
                <span className={`action-priority ${action.priority}`}>{action.priority}</span>
                <span>{action.category}</span>
              </div>
              <h2>{action.title}</h2>
              <p>{action.description}</p>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{actionStatusLabels[action.status]}</dd>
                </div>
                <div>
                  <dt>Stream relevant</dt>
                  <dd>{action.streamRelevant ? "Yes" : "No"}</dd>
                </div>
                <div>
                  <dt>Live safe</dt>
                  <dd>{action.liveSafe ? "Yes" : "No"}</dd>
                </div>
              </dl>
              <div className="action-item-actions">
                <a className="button-link" href={createActionHref(resolvedSearchParams, action.id, "approved")}>
                  Approve
                </a>
                <a
                  className="button-link secondary-action"
                  href={createActionHref(resolvedSearchParams, action.id, "deferred")}
                >
                  Defer
                </a>
                <a className="button-link danger-action" href={createActionHref(resolvedSearchParams, action.id, "rejected")}>
                  Reject
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
};

export default ActionsPage;
