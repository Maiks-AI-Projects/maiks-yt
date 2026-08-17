import type { IconType } from "react-icons";
import {
  FaChartLine,
  FaCoins,
  FaDatabase,
  FaFileLines,
  FaGamepad,
  FaGaugeHigh,
  FaKey,
  FaLink,
  FaListCheck,
  FaPeopleGroup,
  FaPlug,
  FaRoute,
  FaShieldHalved,
  FaTableList,
  FaTowerBroadcast,
  FaUserClock,
  FaUserGear,
  FaUsersGear,
  FaWrench
} from "react-icons/fa6";

export type AdminNavigationItem = {
  href: string;
  label: string;
  description: string;
  icon: IconType;
  statusKey?: string;
};

export type AdminNavigationGroup = {
  id: "testing-safety" | "stream-ops" | "content" | "community" | "finance";
  label: string;
  shortLabel: string;
  href: string;
  description: string;
  icon: IconType;
  items: readonly AdminNavigationItem[];
};

export const adminOverviewNavigationItem: AdminNavigationItem = {
  href: "/admin",
  label: "Overview",
  description: "Compact admin status and area index.",
  icon: FaGaugeHigh
};

export const adminNavigationGroups: readonly AdminNavigationGroup[] = [
  {
    id: "testing-safety",
    label: "Testing & Safety",
    shortLabel: "Testing",
    href: "/admin/testing",
    description: "Readiness checks, provider intake, routing, and live-helper review.",
    icon: FaShieldHalved,
    items: [
      {
        href: "/admin/testing",
        label: "Testing Guide",
        description: "Manual test runbook and readiness commands.",
        icon: FaListCheck,
        statusKey: "smoke"
      },
      {
        href: "/admin/connections",
        label: "Connections",
        description: "Provider event catalog, intake review, and received-event health.",
        icon: FaPlug,
        statusKey: "provider-intake"
      },
      {
        href: "/admin/provider-integrations",
        label: "Provider Integrations",
        description: "Twitch, YouTube, and Discord status and controls.",
        icon: FaWrench
      },
      {
        href: "/admin/event-routing",
        label: "Event Routing",
        description: "Manual routing rules and safe simulated approvals.",
        icon: FaRoute,
        statusKey: "pending-approvals"
      },
      {
        href: "/admin/live-helper",
        label: "Live Helper",
        description: "Active helper grants, alerts, and moderation state.",
        icon: FaPeopleGroup,
        statusKey: "helpers"
      }
    ]
  },
  {
    id: "stream-ops",
    label: "Stream Ops",
    shortLabel: "Ops",
    href: "/admin/schedule",
    description: "Stream scheduling, access URLs, sessions, and backup readiness.",
    icon: FaTowerBroadcast,
    items: [
      {
        href: "/admin/schedule",
        label: "Schedule",
        description: "Plan, edit, cancel, and focus planned streams.",
        icon: FaTableList
      },
      {
        href: "/admin/tokens",
        label: "Access Tokens",
        description: "Create and rotate overlay/control URLs.",
        icon: FaKey
      },
      {
        href: "/admin/sessions",
        label: "Sessions",
        description: "Review and revoke active browser sessions.",
        icon: FaUserClock,
        statusKey: "sessions"
      },
      {
        href: "/admin/backup/health",
        label: "Backup Health",
        description: "Read-only backup readiness checks.",
        icon: FaDatabase,
        statusKey: "backup"
      }
    ]
  },
  {
    id: "content",
    label: "Content",
    shortLabel: "Content",
    href: "/admin/pages",
    description: "Website pages, projects, game library records, and creator links.",
    icon: FaFileLines,
    items: [
      {
        href: "/admin/pages",
        label: "Pages",
        description: "Draft, preview, and publish website content.",
        icon: FaFileLines
      },
      {
        href: "/admin/projects",
        label: "Projects",
        description: "Manage public project details and updates.",
        icon: FaChartLine
      },
      {
        href: "/admin/games",
        label: "Games",
        description: "Curate the game library and stream planning links.",
        icon: FaGamepad
      },
      {
        href: "/admin/links",
        label: "Creator Links",
        description: "Hub destination visibility and ordering.",
        icon: FaLink
      }
    ]
  },
  {
    id: "community",
    label: "Community",
    shortLabel: "Community",
    href: "/admin/moderators",
    description: "Helper, moderator, and role-right administration.",
    icon: FaUsersGear,
    items: [
      {
        href: "/admin/moderators",
        label: "Moderators",
        description: "Manage helper ranks, rights, and grant state.",
        icon: FaUserGear,
        statusKey: "helpers"
      }
    ]
  },
  {
    id: "finance",
    label: "Finance",
    shortLabel: "Finance",
    href: "/admin/money",
    description: "Private accounting review and warning state.",
    icon: FaCoins,
    items: [
      {
        href: "/admin/money",
        label: "Money Ledger",
        description: "Private ledger rows, warnings, dated rules, and exports.",
        icon: FaCoins,
        statusKey: "money"
      }
    ]
  }
];

export const helperAdminNavigationItem: AdminNavigationItem = {
  href: "/admin/live-helper",
  label: "Live Helper",
  description: "Active helper grants, alerts, and moderation state.",
  icon: FaPeopleGroup,
  statusKey: "helpers"
};

export const adminNavigationItems: readonly AdminNavigationItem[] = adminNavigationGroups.flatMap((group) => group.items);

const adminNavigationItemsBySpecificity = [...adminNavigationItems].sort((first, second) =>
  second.href.length - first.href.length
);

export const findAdminNavigationItem = (pathname: string): AdminNavigationItem | null => {
  if (pathname === adminOverviewNavigationItem.href) {
    return adminOverviewNavigationItem;
  }

  return adminNavigationItemsBySpecificity.find((item) =>
    pathname === item.href || pathname.startsWith(`${item.href}/`)
  ) ?? null;
};

export const findAdminNavigationGroup = (pathname: string): AdminNavigationGroup | null => {
  const currentItem = findAdminNavigationItem(pathname);

  if (!currentItem || currentItem.href === adminOverviewNavigationItem.href) {
    return null;
  }

  return adminNavigationGroups.find((group) =>
    group.items.some((item) => item.href === currentItem.href)
  ) ?? null;
};
