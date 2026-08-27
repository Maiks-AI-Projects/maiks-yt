"use client";

import { FiPlus } from "react-icons/fi";

import PublicUpdateAdminInventory from "./public-update-admin-inventory";
import PublicUpdateAdminWorkspace from "./public-update-admin-workspace";
import { usePublicUpdateAdminWorkspace } from "./public-update-admin-workspace.service";
import styles from "./public-update-admin.module.css";

const PublicUpdateAdminClient = (): React.ReactNode => {
  const controller = usePublicUpdateAdminWorkspace();
  const {
    draftCount,
    filter,
    loadState,
    message,
    publishedCount,
    refreshUpdates,
    searchQuery,
    selectRow,
    selectedId,
    setFilter,
    setSearchQuery,
    startNewUpdate,
    updates,
    visibleUpdates
  } = controller;

  return (
    <div className={styles.updatesAdmin}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.headerTitle}>
            <h1>Updates</h1>
            <span>{updates.length} {updates.length === 1 ? "record" : "records"}</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button disabled={loadState !== "ready"} onClick={startNewUpdate} type="button">
            <FiPlus aria-hidden="true" />
            <span>New update</span>
          </button>
        </div>
      </header>

      {loadState !== "ready" ? (
        <section className={styles.loadState}>
          <h2>{loadState === "loading" ? "Loading" : loadState === "signed-out" ? "Sign in required" : loadState === "forbidden" ? "Forbidden" : "Unavailable"}</h2>
          <p>{message}</p>
          {loadState !== "loading" ? (
            <button className="secondary-action" onClick={refreshUpdates} type="button">
              Retry
            </button>
          ) : null}
        </section>
      ) : null}

      {loadState === "ready" ? (
        <div className={styles.layout}>
          <PublicUpdateAdminInventory
            draftCount={draftCount}
            filter={filter}
            onFilterChange={setFilter}
            onSearchChange={setSearchQuery}
            onSelect={selectRow}
            publishedCount={publishedCount}
            searchQuery={searchQuery}
            selectedId={selectedId}
            updates={updates}
            visibleUpdates={visibleUpdates}
          />
          <PublicUpdateAdminWorkspace controller={controller} />
        </div>
      ) : null}
    </div>
  );
};

export default PublicUpdateAdminClient;
