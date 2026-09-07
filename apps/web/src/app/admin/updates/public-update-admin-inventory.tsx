import { FiSearch, FiStar } from "react-icons/fi";
import type { PublicUpdateSource } from "@maiks-yt/domain/updates";

import {
  formatShortDate,
  formatUpdateKind,
  getUpdateSortTime,
  getUpdateStatusLabel,
  isPublishedUpdate,
  type UpdateFilter
} from "./public-update-admin.rules";
import styles from "./public-update-admin.module.css";

type PublicUpdateAdminInventoryProps = {
  filter: UpdateFilter;
  interactionIsLocked: boolean;
  onFilterChange: (filter: UpdateFilter) => void;
  onSearchChange: (query: string) => void;
  onSelect: (update: PublicUpdateSource) => void;
  searchQuery: string;
  selectedId: string;
  updates: readonly PublicUpdateSource[];
  visibleUpdates: readonly PublicUpdateSource[];
};

const PublicUpdateAdminInventory = ({
  filter,
  interactionIsLocked,
  onFilterChange,
  onSearchChange,
  onSelect,
  searchQuery,
  selectedId,
  updates,
  visibleUpdates
}: PublicUpdateAdminInventoryProps): React.ReactNode => (
  <aside className={styles.inventory} aria-label="Saved updates">
    <label className={styles.searchWrap}>
      <span className={styles.visuallyHidden}>Search updates</span>
      <FiSearch className={styles.searchIcon} aria-hidden="true" />
      <input
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search updates..."
        type="search"
        value={searchQuery}
      />
    </label>
    <div className={styles.filterList} role="group" aria-label="Update filters">
      {([
        ["all", "All"],
        ["draft", "Drafts"],
        ["published", "Published"]
      ] as readonly (readonly [UpdateFilter, string])[]).map(([nextFilter, label]) => (
        <button
          aria-pressed={filter === nextFilter}
          className={styles.filterButton}
          data-active={filter === nextFilter}
          key={nextFilter}
          onClick={() => onFilterChange(nextFilter)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
    <div className={styles.columnHeader} aria-hidden="true">
      <span>Update</span>
      <span>Status / Date</span>
    </div>
    <div className={styles.updateList}>
      {visibleUpdates.length === 0 ? (
        <div className={styles.listEmpty}>
          <strong>No matching updates.</strong>
          <span>{updates.length === 0 ? "Save a draft to begin." : "Adjust the search or filter."}</span>
        </div>
      ) : visibleUpdates.map((update) => (
        <button
          aria-current={selectedId === update.id ? "true" : undefined}
          className={styles.updateRow}
          data-selected={selectedId === update.id}
          disabled={interactionIsLocked}
          key={update.id}
          onClick={() => onSelect(update)}
          type="button"
        >
          <span className={styles.updateIdentity}>
            <strong>{update.title}</strong>
            <span className={styles.updateRowKind}>
              <span>{formatUpdateKind(update.kind)}</span>
              {update.isPinned ? (
                <span className={styles.pinnedLabel}>
                  <FiStar aria-hidden="true" />
                  Pinned
                </span>
              ) : null}
            </span>
          </span>
          <span className={styles.updateRowMeta}>
            <span className={styles.statusLabel} data-published={isPublishedUpdate(update)}>
              {getUpdateStatusLabel(update)}
            </span>
            <span className={styles.updateDate}>{formatShortDate(getUpdateSortTime(update))}</span>
          </span>
        </button>
      ))}
    </div>
  </aside>
);

export default PublicUpdateAdminInventory;
