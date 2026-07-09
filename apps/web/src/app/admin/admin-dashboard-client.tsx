"use client";

import { useEffect, useState } from "react";

import { captureDevAuthTokenFromUrl } from "../dev-auth-token";

type AdminDashboardItem = {
  href: string;
  label: string;
  description: string;
};

type AdminDashboardGroup = {
  title: string;
  items: readonly AdminDashboardItem[];
};

const groups: readonly AdminDashboardGroup[] = [
  {
    title: "Testing",
    items: [
      {
        href: "/admin/connections",
        label: "Connections",
        description: "Provider intake catalog, health, and recent received events."
      },
      {
        href: "/admin/provider-integrations",
        label: "Provider Integrations",
        description: "Twitch, YouTube, and Discord connection controls."
      },
      {
        href: "/admin/event-routing",
        label: "Event Routing",
        description: "Manual routing rules and pending simulated approvals."
      },
      {
        href: "/admin/live-helper",
        label: "Live Helper",
        description: "Read-only helper snapshot for moderation and stream state."
      }
    ]
  },
  {
    title: "Stream Operations",
    items: [
      {
        href: "/admin/schedule",
        label: "Schedule",
        description: "Create, edit, cancel, and focus planned streams."
      },
      {
        href: "/admin/tokens",
        label: "Access Tokens",
        description: "Create and rotate overlay/control URL tokens."
      },
      {
        href: "/admin/sessions",
        label: "Sessions",
        description: "Review and revoke active browser sessions."
      },
      {
        href: "/admin/moderators",
        label: "Moderators",
        description: "Manage helper ranks, rights, and grants."
      }
    ]
  },
  {
    title: "Content",
    items: [
      {
        href: "/admin/pages",
        label: "Pages",
        description: "Draft, preview, and publish editable site pages."
      },
      {
        href: "/admin/projects",
        label: "Projects",
        description: "Manage public project content, milestones, and updates."
      },
      {
        href: "/admin/links",
        label: "Creator Links",
        description: "Edit public hub links and availability."
      },
      {
        href: "/admin/money",
        label: "Money Ledger",
        description: "Private ledger entries, warnings, corrections, and exports."
      }
    ]
  }
];

const getDevAuthQuery = (): string => {
  if (typeof window === "undefined") {
    return "";
  }

  const token = window.sessionStorage.getItem("maiks-dev-auth-token");

  return token ? `?devAuthToken=${encodeURIComponent(token)}` : "";
};

const AdminDashboardClient = (): React.ReactNode => {
  const [devAuthQuery, setDevAuthQuery] = useState("");

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    setDevAuthQuery(getDevAuthQuery());
  }, []);

  return (
    <section className="project-admin-shell">
      <header className="project-admin-header">
        <div>
          <p className="eyebrow">Private Admin</p>
          <h1>Admin Dashboard</h1>
          <p>Quick links for testing and operating the current dev build.</p>
        </div>
      </header>

      <div className="project-admin-grid">
        {groups.map((group) => (
          <section className="project-admin-preview" key={group.title}>
            <h2>{group.title}</h2>
            <div className="admin-list">
              {group.items.map((item) => (
                <a className="admin-list-item admin-dashboard-link" href={`${item.href}${devAuthQuery}`} key={item.href}>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.href}</span>
                  </div>
                  <p>{item.description}</p>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
};

export default AdminDashboardClient;
