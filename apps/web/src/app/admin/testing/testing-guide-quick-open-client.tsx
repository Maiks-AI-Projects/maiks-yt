"use client";

import { useEffect, useState } from "react";

import { captureDevAuthTokenFromUrl, getDevAuthToken, withDevAuthToken } from "../../dev-auth-token";

type QuickOpenGroup = {
  title: string;
  links: readonly {
    href: string;
    label: string;
    description: string;
  }[];
};

const quickOpenGroups: readonly QuickOpenGroup[] = [
  {
    title: "Stream Windows",
    links: [
      {
        href: "https://control-dev.maiks.yt/chat",
        label: "Streamer Chat",
        description: "Standalone private chat PWA. Requires the current control access token from Access Tokens."
      },
      {
        href: "https://control-dev.maiks.yt/moderation",
        label: "Moderation",
        description: "Separate moderation PWA. Requires the current control access token plus signed-in rights."
      },
      {
        href: "https://control-dev.maiks.yt/control",
        label: "Control Panel",
        description: "Overlay controls and scene designer. Requires the current control access token."
      },
      {
        href: "https://control-dev.maiks.yt/ai",
        label: "AI Controls",
        description: "Inert AI settings and safety panel. Requires the current control access token."
      },
      {
        href: "https://overlay-dev.maiks.yt/",
        label: "OBS Overlay",
        description: "Current shared overlay surface for OBS/browser-source checks."
      }
    ]
  },
  {
    title: "Private Tools",
    links: [
      {
        href: "/admin/tokens",
        label: "Access Tokens",
        description: "Create or rotate the control/overlay URLs used by OBS and standalone stream windows."
      },
      {
        href: "/tools/notifications",
        label: "Notifications",
        description: "Installed phone/PWA notification panel for dev alerts and smoke failures."
      },
      {
        href: "/admin/sessions",
        label: "Sessions",
        description: "Review browser sessions and revoke suspicious access during testing."
      },
      {
        href: "/admin/connections",
        label: "Connections",
        description: "Provider intake health, recent received events, and provider event catalog."
      },
      {
        href: "/admin/provider-integrations",
        label: "Provider Integrations",
        description: "Twitch, YouTube, and Discord connection controls and runtime status."
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
      },
      {
        href: "/admin/backup/health",
        label: "Backup Health",
        description: "Read-only backup/export readiness checks before testing."
      }
    ]
  },
  {
    title: "Admin Workflows",
    links: [
      {
        href: "/admin/moderators",
        label: "Moderators",
        description: "Manage ranks, rights, grants, and helper access."
      },
      {
        href: "/admin/money",
        label: "Money Ledger",
        description: "Private accounting entries, corrections, warnings, and exports."
      },
      {
        href: "/admin/pages",
        label: "Page Creator",
        description: "Draft, preview, publish, unpublish, and clean up test pages."
      },
      {
        href: "/admin/games",
        label: "Games Admin",
        description: "Manage the curated game library and pending suggestions."
      },
      {
        href: "/admin/projects",
        label: "Projects Admin",
        description: "Preview and maintain project updates, item links, and estimates."
      },
      {
        href: "/admin/schedule",
        label: "Schedule Admin",
        description: "Create planned streams and link project or game focus."
      },
      {
        href: "/admin/links",
        label: "Creator Links",
        description: "Edit public Creator Hub links and availability."
      }
    ]
  },
  {
    title: "Account And Public Pages",
    links: [
      {
        href: "/account",
        label: "Account",
        description: "Linked accounts, profile visibility, and stream visibility preferences."
      },
      {
        href: "/links",
        label: "Links",
        description: "Public Creator Hub link list."
      },
      {
        href: "/projects",
        label: "Projects",
        description: "Public project list and project-detail entry point."
      },
      {
        href: "/schedule",
        label: "Schedule",
        description: "Public stream schedule with focus/project/game links."
      },
      {
        href: "/games",
        label: "Games",
        description: "Public curated game library."
      },
      {
        href: "/updates",
        label: "Updates",
        description: "Public update feed and changelog-style posts."
      },
      {
        href: "/community-rules",
        label: "Community Rules",
        description: "Public community behavior baseline for testing moderation wording."
      },
      {
        href: "/privacy/analytics",
        label: "Privacy Analytics",
        description: "Public analytics and privacy boundary explanation."
      },
      {
        href: "/accountability",
        label: "Accountability",
        description: "Public accountability and project-history context."
      }
    ]
  }
] as const;

export const TestingGuideQuickOpenClient = (): React.ReactNode => {
  const [devAuthToken, setDevAuthToken] = useState<string | null>(null);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    setDevAuthToken(getDevAuthToken());
  }, []);

  return (
    <section className="project-admin-panel">
      <div className="project-admin-panel-heading">
        <div>
          <h2>Quick Open</h2>
          <p>Open the windows and pages used most during a first testing pass.</p>
        </div>
      </div>
      <div className="project-admin-grid">
        {quickOpenGroups.map((group) => (
          <section className="project-admin-preview" key={group.title}>
            <h3>{group.title}</h3>
            <div className="admin-list">
              {group.links.map((link) => (
                <a className="admin-list-item admin-dashboard-link" href={withDevAuthToken(link.href, devAuthToken)} key={link.href}>
                  <div>
                    <strong>{link.label}</strong>
                    <span>{link.href}</span>
                  </div>
                  <p>{link.description}</p>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
};
