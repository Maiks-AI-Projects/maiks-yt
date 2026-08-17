"use client";

import { usePathname } from "next/navigation";

import { withDevAuthToken } from "../dev-auth-token";
import { AdminAccessProvider, useAdminAccess } from "./admin-access";
import {
  adminNavigationGroups,
  adminOverviewNavigationItem,
  findAdminNavigationGroup,
  findAdminNavigationItem,
  helperAdminNavigationItem
} from "./admin-navigation-data";
import styles from "./admin-navigation.module.css";

type AdminShellProps = {
  children: React.ReactNode;
};

const AdminShellContent = ({ children }: AdminShellProps): React.ReactNode => {
  const pathname = usePathname();
  const { accessState, devAuthToken } = useAdminAccess();
  const currentItem = findAdminNavigationItem(pathname) ?? adminOverviewNavigationItem;
  const currentGroup = findAdminNavigationGroup(pathname);
  const currentContext = accessState === "owner"
    ? currentGroup?.label ?? currentItem.label
    : accessState === "helper"
      ? helperAdminNavigationItem.label
      : accessState === "checking"
        ? "Checking access"
        : "Access required";
  const overviewIsCurrent = currentItem.href === adminOverviewNavigationItem.href;
  const buildHref = (href: string): string => withDevAuthToken(href, devAuthToken);

  const renderGroupedNavigation = (): React.ReactNode => (
    <>
      <a
        aria-current={overviewIsCurrent ? "page" : undefined}
        className={styles.overviewLink}
        href={buildHref(adminOverviewNavigationItem.href)}
      >
        <strong>{adminOverviewNavigationItem.label}</strong>
        <span>{adminOverviewNavigationItem.description}</span>
      </a>
      {adminNavigationGroups.map((group) => {
        const groupIsCurrent = currentGroup?.id === group.id;

        return (
          <section className={styles.navGroup} data-current={groupIsCurrent ? "true" : undefined} key={group.id}>
            <a className={styles.groupLink} href={buildHref(group.href)}>
              <span>{group.label}</span>
              <small>{group.description}</small>
            </a>
            <div className={styles.itemList}>
              {group.items.map((item) => {
                const itemIsCurrent = currentItem.href === item.href;

                return (
                  <a
                    aria-current={itemIsCurrent ? "page" : undefined}
                    className={styles.itemLink}
                    href={buildHref(item.href)}
                    key={item.href}
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );

  const renderHelperNavigation = (): React.ReactNode => (
    <a
      aria-current={pathname === helperAdminNavigationItem.href ? "page" : undefined}
      className={styles.overviewLink}
      href={buildHref(helperAdminNavigationItem.href)}
    >
      <strong>{helperAdminNavigationItem.label}</strong>
      <span>{helperAdminNavigationItem.description}</span>
    </a>
  );

  const renderRestrictedNotice = (): React.ReactNode => (
    <p className={styles.navNotice}>
      {accessState === "checking" ? "Checking your admin access..." : "Sign in with an account that has access to this admin area."}
    </p>
  );

  const renderNavigation = (): React.ReactNode => {
    if (accessState === "owner") {
      return renderGroupedNavigation();
    }

    if (accessState === "helper") {
      return renderHelperNavigation();
    }

    return renderRestrictedNotice();
  };

  return (
    <div className={styles.adminLayout}>
      <aside className={styles.desktopRail} aria-label="Admin navigation">
        <div className={styles.railHeader}>
          <span>Admin</span>
          <strong>{currentContext}</strong>
        </div>
        <nav className={styles.railNavigation}>{renderNavigation()}</nav>
      </aside>

      <div className={styles.mobileNavigation}>
        <div className={styles.mobileContext}>
          <span>Admin</span>
          <strong>{currentContext}</strong>
        </div>
        {accessState === "none" || accessState === "checking" ? (
          renderRestrictedNotice()
        ) : (
          <details className={styles.mobileDisclosure}>
            <summary>Destinations</summary>
            <nav className={styles.mobileDestinationList} aria-label="Admin destinations">
              {renderNavigation()}
            </nav>
          </details>
        )}
      </div>

      <div className={styles.content}>{children}</div>
    </div>
  );
};

const AdminShell = ({ children }: AdminShellProps): React.ReactNode => (
  <AdminAccessProvider>
    <AdminShellContent>{children}</AdminShellContent>
  </AdminAccessProvider>
);

export default AdminShell;
