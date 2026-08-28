import type { ContentPageAdminBrowserPage } from "@maiks-yt/domain/pages";
import { FiInfo, FiSearch } from "react-icons/fi";

import { getRelativeUpdatedAt } from "./page-creator-admin.rules";
import styles from "./page-creator-admin.module.css";

export type PageFilter = "all" | "draft";

type PageCreatorInventoryProps = {
  draftCount: number;
  filter: PageFilter;
  onFilterChange: (filter: PageFilter) => void;
  onSearchChange: (query: string) => void;
  onSelect: (id: string) => void;
  pages: readonly ContentPageAdminBrowserPage[];
  searchQuery: string;
  selectedId: string;
  visiblePages: readonly ContentPageAdminBrowserPage[];
};

const PageCreatorInventory = ({
  draftCount,
  filter,
  onFilterChange,
  onSearchChange,
  onSelect,
  pages,
  searchQuery,
  selectedId,
  visiblePages
}: PageCreatorInventoryProps): React.ReactNode => (
  <aside className={styles.inventory} aria-label="Manual pages">
    <div className={styles.paneHeading}>
      <h2>Manual pages</h2>
      <span>{pages.length}</span>
    </div>
    <label className={styles.searchWrap}>
      <span className={styles.visuallyHidden}>Find a page</span>
      <FiSearch className={styles.searchIcon} aria-hidden="true" />
      <input
        type="search"
        placeholder="Find a page"
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
      />
    </label>
    <div className={styles.filterList} aria-label="Filter pages">
      {([
        ["all", "All"],
        ["draft", `Drafts ${draftCount}`]
      ] as const).map(([filterOption, label]) => (
        <button
          className={styles.filterButton}
          data-active={filter === filterOption}
          key={filterOption}
          onClick={() => onFilterChange(filterOption)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
    <div className={styles.pageList}>
      {visiblePages.length === 0 ? (
        <p className={styles.listEmpty}>
          {pages.length === 0 ? "No manual pages yet." : "No pages match this view."}
        </p>
      ) : visiblePages.map((page) => (
        <button
          className={styles.pageRow}
          data-selected={page.id === selectedId}
          key={page.id}
          onClick={() => onSelect(page.id)}
          type="button"
        >
          <span className={styles.pageIdentity}>
            <strong>{page.title}</strong>
            <span>{page.normalizedPath}</span>
          </span>
          <span className={styles.pageMeta}>
            <span className={styles.stateLabel} data-published={page.status === "published"}>
              <span className={styles.stateDot} aria-hidden="true" />
              {page.status}
            </span>
            <time dateTime={page.updatedAt}>{getRelativeUpdatedAt(page.updatedAt)}</time>
          </span>
        </button>
      ))}
    </div>
    <div className={styles.inventoryFooter}>
      <FiInfo aria-hidden="true" />
      <span>Manual routes on maiks.yt</span>
    </div>
  </aside>
);

export default PageCreatorInventory;
