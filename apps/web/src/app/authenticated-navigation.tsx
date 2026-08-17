"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createApiHeaders } from "./dev-auth-token";
import styles from "./site-shell.module.css";

type AuthenticatedNavigationProps = {
  context: "account";
};

type NavigationItem = {
  href: string;
  label: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const accountItems: readonly NavigationItem[] = [
  { href: "/account", label: "Overview" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/connections", label: "Connections" },
  { href: "/account/privacy", label: "Privacy" },
  { href: "/account/stream", label: "Stream appearance" },
  { href: "/tools/notifications", label: "Notifications" }
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
    || (item.href !== "/admin" && item.href !== "/account" && pathname.startsWith(`${item.href}/`))
  )) ?? firstItem;

  return (
    <div className={styles.contextBar}>
      <nav className={styles.contextLinks} aria-label="Account navigation">
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
        <span>Account view</span>
        <select
          aria-label="Open account view"
          value={currentItem.href}
          onChange={(event) => window.location.assign(event.target.value)}
        >
          {items.map((item) => <option value={item.href} key={item.href}>{item.label}</option>)}
        </select>
      </label>
    </div>
  );
};
