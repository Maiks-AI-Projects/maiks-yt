import {
  FiChevronDown,
  FiClock,
  FiMonitor,
  FiMoreVertical,
  FiSmartphone
} from "react-icons/fi";

import { formatSessionActivity, formatSessionDate } from "./session-admin-data";
import styles from "./session-admin.module.css";
import type { DeviceSummary } from "./session-admin-data";
import type { SessionAdminRecord } from "./session-admin.types";

type SessionAdminRowsProps = {
  session: SessionAdminRecord;
  device: DeviceSummary;
  isExpanded: boolean;
  isBusy: boolean;
  onToggleDetails: () => void;
  onRevoke: () => void;
};

const SessionAdminRows = ({
  session,
  device,
  isExpanded,
  isBusy,
  onToggleDetails,
  onRevoke
}: SessionAdminRowsProps): React.ReactNode => {
  const DeviceIcon = device.mobile ? FiSmartphone : FiMonitor;

  return (
    <>
      <tr className={`${styles.sessionRow} ${session.isCurrent ? styles.currentRow : ""} ${isExpanded ? styles.reviewRow : ""}`}>
        <td data-label="Device">
          <div className={styles.deviceCell}>
            {!session.isCurrent ? (
              <button
                className={styles.disclosureButton}
                type="button"
                onClick={onToggleDetails}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Hide" : "Review"} details for ${device.label}`}
              >
                <FiChevronDown aria-hidden="true" />
              </button>
            ) : null}
            <DeviceIcon className={styles.deviceIcon} aria-hidden="true" />
            <div>
              <div className={styles.deviceHeading}>
                <strong>{device.label}</strong>
                {session.isCurrent ? <span className={styles.currentBadge}>This device</span> : null}
                {session.isExpired ? <span className={styles.expiredBadge}>Expired</span> : null}
              </div>
              <small>{session.isCurrent ? "Current browser session" : "Other account session"}</small>
            </div>
          </div>
        </td>
        <td data-label="Location / IP">
          <span className={isExpanded ? styles.reviewEvidence : undefined}>Location unavailable</span>
          <code>{session.ipAddress ?? "IP unavailable"}</code>
        </td>
        <td data-label="Last activity">
          <span className={session.isCurrent ? styles.activeTime : styles.activityTime}>
            {session.isCurrent ? <span className={styles.activeDot} aria-hidden="true" /> : <FiClock aria-hidden="true" />}
            {formatSessionActivity(session.updatedAt)}
          </span>
        </td>
        <td data-label="Signed in">
          <time dateTime={session.createdAt}>{formatSessionDate(session.createdAt)}</time>
        </td>
        <td data-label="Expires">
          <time dateTime={session.expiresAt}>{formatSessionDate(session.expiresAt)}</time>
        </td>
        <td data-label="Action" className={styles.actionCell}>
          {session.isCurrent ? (
            <details className={styles.currentActionMenu}>
              <summary>
                <span>Current session</span>
                <FiMoreVertical aria-hidden="true" />
              </summary>
              <div>
                <button type="button" onClick={onRevoke} disabled={isBusy}>
                  {isBusy ? "Revoking..." : "Revoke this session"}
                </button>
                <small>You will be signed out here.</small>
              </div>
            </details>
          ) : (
            <button className={styles.revokeButton} type="button" onClick={onRevoke} disabled={isBusy}>
              {isBusy ? "Revoking..." : "Revoke access"}
            </button>
          )}
        </td>
      </tr>
      {isExpanded ? (
        <tr className={styles.detailsRow}>
          <td colSpan={6}>
            <div className={styles.detailsPanel}>
              <header>
                <FiChevronDown aria-hidden="true" />
                <h3>Review this session</h3>
              </header>
              <dl className={styles.evidenceGrid}>
                <div><dt>Device</dt><dd>{device.label}</dd></div>
                <div><dt>IP address</dt><dd>{session.ipAddress ?? "Unavailable"}</dd></div>
                <div><dt>Last activity</dt><dd>{formatSessionActivity(session.updatedAt)}</dd></div>
                <div><dt>Last updated</dt><dd>{formatSessionDate(session.updatedAt)}</dd></div>
              </dl>
              <div className={styles.userAgent}>
                <span>User agent</span>
                <code title={session.userAgent ?? undefined}>{session.userAgent ?? "Unavailable"}</code>
              </div>
              <div className={styles.reviewFooter}>
                <p>If you don&apos;t recognize this device or activity, revoke access now.</p>
                <button className={styles.dangerButton} type="button" onClick={onRevoke} disabled={isBusy}>
                  {isBusy ? "Revoking..." : "Revoke this session"}
                </button>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
};

export default SessionAdminRows;
