"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createApiHeaders } from "./dev-auth-token";
import styles from "./site-shell.module.css";

type AuthenticatedNavigationProps = {
  context: "account" | "admin";
};

type NavigationItem = {
  href: string;
  label: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const accountItems: readonly NavigationItem[] = [
  { href: "/account", label: "Overview" },
  { href: "/account#connections-title", label: "Connections" },
  { href: "/account#privacy-title", label: "Privacy" },
  { href: "/account#stream-title", label: "Stream appearance" },
  { href: "/tools/notifications", label: "Notifications" }
];

const ownerItems: readonly NavigationItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/pages", label: "Content" },
  { href: "/admin/moderators", label: "Community" },
  { href: "/admin/schedule", label: "Stream" },
  { href: "/admin/provider-integrations", label: "Providers" },
  { href: "/admin/money", label: "Finance" },
  { href: "/admin/testing", label: "Testing" }
];

const helperItems: readonly NavigationItem[] = [
  { href: "/admin/live-helper", label: "Live helper" }
];

export const AuthenticatedNavigation = ({ context }: AuthenticatedNavigationProps): React.ReactNode => {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);
  const [hasOwnerAccess, setHasOwnerAccess] = useState(false);
  const [hasHelperAccess, setHasHelperAccess] = useState(false);

  useEffect(() => {
    let active = true;

    const loadAccess = async (): Promise<void> => {
      try {
        const sessionResponse = await fetch(`${apiBaseUrl}/account/session`, {
          credentials: "include",
          headers: createApiHeaders()
        });

        if (!sessionResponse.ok || !await sessionResponse.json()) {
          return;
        }

        if (!active) {
          return;
        }

        setSignedIn(true);

        const [ownerResponse, helperResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/admin/provider-integrations/status`, {
            credentials: "include",
            headers: createApiHeaders()
          }),
          fetch(`${apiBaseUrl}/admin/live-helper`, {
            credentials: "include",
            headers: createApiHeaders()
          })
        ]);

        if (active) {
          setHasOwnerAccess(ownerResponse.ok);
          setHasHelperAccess(helperResponse.ok);
        }
      } catch {
        // The primary account panel owns session error feedback. Navigation fails closed.
      }
    };

    void loadAccess();

    return () => {
      active = false;
    };
  }, []);

  const items = useMemo<readonly NavigationItem[]>(() => {
    if (!signedIn) {
      return [];
    }

    if (context === "admin") {
      if (hasOwnerAccess) {
        return ownerItems;
      }

      return hasHelperAccess ? helperItems : [];
    }

    const privilegedItem = hasOwnerAccess
      ? [{ href: "/admin", label: "Admin" }]
      : hasHelperAccess
        ? [{ href: "/admin/live-helper", label: "Live helper" }]
        : [];

    return [...accountItems, ...privilegedItem];
  }, [context, hasHelperAccess, hasOwnerAccess, signedIn]);

  const firstItem = items[0];

  if (!firstItem) {
    return null;
  }

  const currentItem = items.find((item) => (
    item.href === pathname
    || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))
  )) ?? firstItem;

  return (
    <div className={styles.contextBar}>
      <nav className={styles.contextLinks} aria-label={context === "admin" ? "Admin navigation" : "Account navigation"}>
        {items.map((item) => (
          <a
            aria-current={item.href === currentItem.href ? "page" : undefined}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <label className={styles.contextSelectLabel}>
        <span>{context === "admin" ? "Admin view" : "Account view"}</span>
        <select
          aria-label={context === "admin" ? "Open admin view" : "Open account view"}
          value={currentItem.href}
          onChange={(event) => window.location.assign(event.target.value)}
        >
          {items.map((item) => <option value={item.href} key={item.href}>{item.label}</option>)}
        </select>
      </label>
    </div>
  );
};
