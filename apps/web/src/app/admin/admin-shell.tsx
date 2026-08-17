"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FiChevronDown, FiHome, FiLogIn, FiLogOut, FiMenu, FiSettings, FiUser } from "react-icons/fi";

import { clearDevAuthToken, createApiHeaders, withDevAuthToken } from "../dev-auth-token";
import { AdminAccessProvider, useAdminAccess } from "./admin-access";
import {
  adminNavigationGroups,
  adminOverviewNavigationItem,
  findAdminNavigationGroup,
  findAdminNavigationItem,
  helperAdminNavigationItem,
  type AdminNavigationGroup,
  type AdminNavigationItem
} from "./admin-navigation-data";
import styles from "./admin-navigation.module.css";

type AdminShellProps = {
  children: React.ReactNode;
};

type NavigationRenderOptions = {
  idPrefix: string;
};

type AdminMenuLink = {
  href: string;
  label: string;
  description: string;
  icon: AdminNavigationItem["icon"];
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const getTooltipId = (idPrefix: string, href: string): string =>
  `${idPrefix}-${href.replaceAll("/", "-").replace(/^-/, "") || "admin"}-tip`;

const AdminNavigationTooltip = ({
  id,
  children
}: {
  id: string;
  children: React.ReactNode;
}): React.ReactNode => (
  <span className={styles.tooltip} id={id} role="tooltip">
    {children}
  </span>
);

const AdminItemLink = ({
  item,
  current,
  href,
  idPrefix,
  variant = "item"
}: {
  item: AdminNavigationItem;
  current: boolean;
  href: string;
  idPrefix: string;
  variant?: "overview" | "item";
}): React.ReactNode => {
  const Icon = item.icon;
  const tooltipId = getTooltipId(idPrefix, item.href);

  return (
    <a
      aria-current={current ? "page" : undefined}
      aria-describedby={tooltipId}
      aria-label={`${item.label}: ${item.description}`}
      className={variant === "overview" ? styles.overviewLink : styles.itemLink}
      href={href}
      title={item.description}
    >
      <Icon aria-hidden="true" className={styles.navIcon} />
      <span>{item.label}</span>
      <AdminNavigationTooltip id={tooltipId}>{item.description}</AdminNavigationTooltip>
    </a>
  );
};

const AdminGroupLink = ({
  group,
  current,
  href,
  idPrefix
}: {
  group: AdminNavigationGroup;
  current: boolean;
  href: string;
  idPrefix: string;
}): React.ReactNode => {
  const Icon = group.icon;
  const tooltipId = getTooltipId(idPrefix, group.href);

  return (
    <a
      aria-describedby={tooltipId}
      aria-label={`${group.label}: ${group.description}`}
      className={styles.groupLink}
      data-current={current ? "true" : undefined}
      href={href}
      title={group.description}
    >
      <Icon aria-hidden="true" className={styles.navIcon} />
      <span>{group.label}</span>
      <FiChevronDown aria-hidden="true" className={styles.groupChevron} />
      <AdminNavigationTooltip id={tooltipId}>{group.description}</AdminNavigationTooltip>
    </a>
  );
};

const AdminShellContent = ({ children }: AdminShellProps): React.ReactNode => {
  const pathname = usePathname();
  const { accessState, accountIdentity, devAuthToken } = useAdminAccess();
  const [signOutState, setSignOutState] = useState<"idle" | "busy" | "error">("idle");
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
  const OverviewIcon = adminOverviewNavigationItem.icon;
  const HelperIcon = helperAdminNavigationItem.icon;
  const roleLabel =
    accessState === "owner"
      ? "Owner"
      : accessState === "helper"
        ? "Helper"
        : accessState === "checking"
          ? "Checking"
          : "Signed out";
  const accountSummaryLabel = accountIdentity.isSignedIn ? accountIdentity.displayName : "Sign in";
  const accountInitial = accountSummaryLabel.slice(0, 1).toUpperCase();
  const permittedMajorLinks: readonly AdminMenuLink[] =
    accessState === "owner"
      ? adminNavigationGroups.map((group) => ({
          href: group.href,
          label: group.label,
          description: group.description,
          icon: group.icon
        }))
      : accessState === "helper"
        ? [helperAdminNavigationItem]
        : [];
  const helperRouteIsCurrent =
    pathname === helperAdminNavigationItem.href || pathname.startsWith(`${helperAdminNavigationItem.href}/`);
  const canRenderAdminContent = accessState === "owner" || (accessState === "helper" && helperRouteIsCurrent);

  const signOut = async (): Promise<void> => {
    setSignOutState("busy");

    try {
      const response = await fetch(`${apiBaseUrl}/auth/sign-out`, {
        method: "POST",
        credentials: "include",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({})
      });

      if (!response.ok && response.status !== 401) {
        throw new Error(`Sign out failed with HTTP ${response.status}.`);
      }

      clearDevAuthToken();
      window.location.assign("/");
    } catch {
      setSignOutState("error");
    }
  };

  const renderGroupedNavigation = ({ idPrefix }: NavigationRenderOptions): React.ReactNode => (
    <>
      <AdminItemLink
        current={overviewIsCurrent}
        href={buildHref(adminOverviewNavigationItem.href)}
        idPrefix={idPrefix}
        item={adminOverviewNavigationItem}
        variant="overview"
      />
      {adminNavigationGroups.map((group) => {
        const groupIsCurrent = currentGroup?.id === group.id;

        return (
          <section className={styles.navGroup} data-current={groupIsCurrent ? "true" : undefined} key={group.id}>
            <AdminGroupLink
              current={groupIsCurrent}
              group={group}
              href={buildHref(group.href)}
              idPrefix={idPrefix}
            />
            <div className={styles.itemList}>
              {group.items.map((item) => {
                const itemIsCurrent = currentItem.href === item.href;

                return (
                  <AdminItemLink
                    current={itemIsCurrent}
                    href={buildHref(item.href)}
                    idPrefix={idPrefix}
                    item={item}
                    key={item.href}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );

  const renderHelperNavigation = ({ idPrefix }: NavigationRenderOptions): React.ReactNode => (
    <AdminItemLink
      current={pathname === helperAdminNavigationItem.href}
      href={buildHref(helperAdminNavigationItem.href)}
      idPrefix={idPrefix}
      item={helperAdminNavigationItem}
      variant="overview"
    />
  );

  const renderRestrictedNotice = (): React.ReactNode => (
    <p className={styles.navNotice}>
      {accessState === "checking" ? "Checking your admin access..." : "Sign in with an account that has access to this admin area."}
    </p>
  );

  const renderNavigation = (options: NavigationRenderOptions): React.ReactNode => {
    if (accessState === "owner") {
      return renderGroupedNavigation(options);
    }

    if (accessState === "helper") {
      return renderHelperNavigation(options);
    }

    return renderRestrictedNotice();
  };

  const renderContent = (): React.ReactNode => {
    if (canRenderAdminContent) {
      return children;
    }

    const isChecking = accessState === "checking";
    const isHelper = accessState === "helper";

    return (
      <main className={styles.restrictedContent}>
        <p className={styles.restrictedEyebrow}>
          {isChecking ? "Checking" : isHelper ? "Limited access" : "Access required"}
        </p>
        <h1>{isChecking ? "Checking access" : isHelper ? "This area is not available" : "Sign in required"}</h1>
        <p>
          {isChecking
            ? "Admin content stays hidden until your access is confirmed."
            : isHelper
              ? "This account can open only its permitted helper area."
              : "No admin inventory is shown without a permitted account."}
        </p>
        <div className={styles.restrictedActions}>
          <a href="/" title="Back to public home">
            <FiHome aria-hidden="true" />
            <span>Back to Home</span>
          </a>
          <a href={buildHref("/account")} title={accessState === "none" ? "Sign in through account settings" : "Open account settings"}>
            {accessState === "none" ? <FiLogIn aria-hidden="true" /> : <FiSettings aria-hidden="true" />}
            <span>{accessState === "none" ? "Sign in" : "Account settings"}</span>
          </a>
          {isHelper ? (
            <a href={buildHref(helperAdminNavigationItem.href)} title={helperAdminNavigationItem.description}>
              <HelperIcon aria-hidden="true" />
              <span>{helperAdminNavigationItem.label}</span>
            </a>
          ) : null}
        </div>
      </main>
    );
  };

  return (
    <div className={styles.adminLayout}>
      <a className={styles.skipLink} href="#admin-content">Skip to admin content</a>
      <header className={styles.topBar}>
        <a className={styles.adminBrand} href={buildHref("/admin")} aria-label="Maiks.yt Admin overview">
          <Image
            alt=""
            aria-hidden="true"
            className={styles.brandMark}
            height={32}
            priority
            src="/brand/icon-64.png"
            width={32}
          />
          <span>
            <strong>Maiks.yt</strong>
            <small>Admin</small>
          </span>
        </a>
        <div className={styles.topContext} aria-live="polite">
          <span>{currentContext}</span>
        </div>
        <details className={styles.accountMenu}>
          <summary aria-label="Open admin account and navigation menu">
            <span className={styles.accountAvatar} aria-hidden="true">
              {accountIdentity.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={accountIdentity.avatarUrl} />
              ) : accountIdentity.isSignedIn ? (
                accountInitial
              ) : (
                <FiUser aria-hidden="true" />
              )}
            </span>
            <span className={styles.accountSummaryText}>
              <strong>{accountSummaryLabel}</strong>
              <small>{roleLabel}</small>
            </span>
          </summary>
          <nav className={styles.accountMenuPanel} aria-label="Account and admin navigation">
            <div className={styles.accountIdentityRow}>
              <span className={styles.accountAvatar} aria-hidden="true">
                {accountIdentity.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={accountIdentity.avatarUrl} />
                ) : accountIdentity.isSignedIn ? (
                  accountInitial
                ) : (
                  <FiUser aria-hidden="true" />
                )}
              </span>
              <span>
                <strong>{accountSummaryLabel}</strong>
                <small>{accountIdentity.email ?? roleLabel}</small>
              </span>
            </div>
            <a href="/">
              <FiHome aria-hidden="true" />
              <span>Back to Home</span>
            </a>
            <a href={buildHref("/account")}>
              {accessState === "none" ? <FiLogIn aria-hidden="true" /> : <FiSettings aria-hidden="true" />}
              <span>{accessState === "none" ? "Sign in" : "Account settings"}</span>
            </a>
            {accessState === "owner" ? (
              <>
                <a href={buildHref(adminOverviewNavigationItem.href)}>
                  <OverviewIcon aria-hidden="true" />
                  <span>Admin overview</span>
                </a>
              </>
            ) : null}
            {permittedMajorLinks.length > 0 ? (
              <>
                <div className={styles.accountMenuDivider} role="separator" />
                {permittedMajorLinks.map((link) => {
                  const Icon = link.icon;

                  return (
                    <a href={buildHref(link.href)} key={link.href} title={link.description}>
                      <Icon aria-hidden="true" />
                      <span>{link.label}</span>
                    </a>
                  );
                })}
              </>
            ) : null}
            {accountIdentity.isSignedIn ? (
              <>
                <div className={styles.accountMenuDivider} role="separator" />
                <button
                  className={styles.signOutButton}
                  disabled={signOutState === "busy"}
                  onClick={() => void signOut()}
                  type="button"
                >
                  <FiLogOut aria-hidden="true" />
                  <span>{signOutState === "busy" ? "Signing out..." : "Sign out"}</span>
                </button>
                {signOutState === "error" ? (
                  <p className={styles.signOutError}>Sign out failed. Try again from account settings.</p>
                ) : null}
              </>
            ) : null}
          </nav>
        </details>
      </header>

      <aside className={styles.desktopRail} aria-label="Admin navigation">
        <nav className={styles.railNavigation}>{renderNavigation({ idPrefix: "desktop-admin-nav" })}</nav>
      </aside>

      <div className={styles.mobileNavigation}>
        <div className={styles.mobileContext}>
          <span>Admin menu</span>
          <strong>{currentContext}</strong>
        </div>
        {accessState === "none" || accessState === "checking" ? (
          renderRestrictedNotice()
        ) : (
          <details className={styles.mobileDisclosure}>
            <summary>
              <FiMenu aria-hidden="true" />
              <span>Destinations</span>
            </summary>
            <nav className={styles.mobileDestinationList} aria-label="Admin destinations">
              {renderNavigation({ idPrefix: "mobile-admin-nav" })}
            </nav>
          </details>
        )}
      </div>

      <div className={styles.content} id="admin-content">{renderContent()}</div>
    </div>
  );
};

const AdminShell = ({ children }: AdminShellProps): React.ReactNode => (
  <AdminAccessProvider>
    <AdminShellContent>{children}</AdminShellContent>
  </AdminAccessProvider>
);

export default AdminShell;
