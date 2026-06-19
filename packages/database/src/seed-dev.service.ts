import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";

import { createDatabase, createDatabasePool } from "./database.service.js";
import {
  actionItems,
  creatorLinks,
  eventReplayEvents,
  eventReplaySessions,
  linkedAccounts,
  overlayStates,
  projectItemLinks,
  projectItems,
  projectMilestones,
  projects,
  roles,
  streamScheduleEntries,
  streamSessions,
  userRoles,
  users,
  valueSources
} from "./database.schema.js";

const pool = createDatabasePool();
const database = createDatabase(pool);

const creatorUserId = "00000000-0000-4000-8000-000000000001";
const creatorLinkedAccountId = "00000000-0000-4000-8000-000000000002";
const ownerRoleId = "00000000-0000-4000-8000-000000000010";
const ownerUserRoleId = "00000000-0000-4000-8000-000000000011";
const projectId = "00000000-0000-4000-8000-000000000020";
const milestoneId = "00000000-0000-4000-8000-000000000021";
const projectItemId = "00000000-0000-4000-8000-000000000022";
const projectItemLinkId = "00000000-0000-4000-8000-000000000023";
const overlayThemeProjectId = "00000000-0000-4000-8000-000000000070";
const overlayThemeMilestoneId = "00000000-0000-4000-8000-000000000071";
const overlayThemeItemId = "00000000-0000-4000-8000-000000000072";
const communityProjectId = "00000000-0000-4000-8000-000000000080";
const communityMilestoneId = "00000000-0000-4000-8000-000000000081";
const communityItemId = "00000000-0000-4000-8000-000000000082";
const streamSessionId = "00000000-0000-4000-8000-000000000030";
const overlayStateId = "00000000-0000-4000-8000-000000000031";
const upcomingStreamScheduleId = "00000000-0000-4000-8000-000000000032";
const cancelledStreamScheduleId = "00000000-0000-4000-8000-000000000033";
const replaySessionId = "00000000-0000-4000-8000-000000000040";
const creatorLinkSeeds = [
  {
    id: "00000000-0000-4000-8000-000000000100",
    key: "current-stream-home",
    title: "Current Stream Home",
    description: "Main public entry point for streams, projects, updates, and account access.",
    purpose: "stream",
    icon: "stream",
    availability: "available",
    href: "/",
    availabilityNote: null,
    isPrimary: true,
    sortOrder: 10,
    isPublished: true
  },
  {
    id: "00000000-0000-4000-8000-000000000101",
    key: "projects",
    title: "Projects",
    description: "Public read-only project plans, milestones, and non-monetary work items.",
    purpose: "project",
    icon: "project",
    availability: "available",
    href: "/projects",
    availabilityNote: null,
    isPrimary: false,
    sortOrder: 20,
    isPublished: true
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    key: "twitch",
    title: "Twitch",
    description: "Live streams, chat, and stream alerts on the main MaiksMC Twitch channel.",
    purpose: "social",
    icon: "twitch",
    availability: "available",
    href: "https://www.twitch.tv/maiksmc",
    availabilityNote: null,
    isPrimary: false,
    sortOrder: 30,
    isPublished: true
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    key: "maiksmc-youtube",
    title: "MaiksMC YouTube",
    description: "The main YouTube channel for MaiksMC uploads and stream-adjacent videos.",
    purpose: "social",
    icon: "youtube",
    availability: "available",
    href: "https://www.youtube.com/@maiksMC",
    availabilityNote: null,
    isPrimary: false,
    sortOrder: 40,
    isPublished: true
  },
  {
    id: "00000000-0000-4000-8000-000000000104",
    key: "wow-with-maiks",
    title: "WoW with Maiks",
    description: "World of Warcraft videos and related channel experiments.",
    purpose: "social",
    icon: "youtube",
    availability: "available",
    href: "https://www.youtube.com/@wowwithmaiks2218",
    availabilityNote: null,
    isPrimary: false,
    sortOrder: 50,
    isPublished: true
  },
  {
    id: "00000000-0000-4000-8000-000000000105",
    key: "maiks-talking",
    title: "Maiks Talking",
    description: "Talking, updates, and creator-side video experiments.",
    purpose: "social",
    icon: "youtube",
    availability: "available",
    href: "https://www.youtube.com/@maikstalking9763",
    availabilityNote: null,
    isPrimary: false,
    sortOrder: 60,
    isPublished: true
  },
  {
    id: "00000000-0000-4000-8000-000000000106",
    key: "coding-with-maiks",
    title: "Coding with Maiks",
    description: "Coding videos and build-log style experiments.",
    purpose: "social",
    icon: "youtube",
    availability: "available",
    href: "https://www.youtube.com/@codingwithmaiks1339/featured",
    availabilityNote: null,
    isPrimary: false,
    sortOrder: 70,
    isPublished: true
  },
  {
    id: "00000000-0000-4000-8000-000000000107",
    key: "discord-community",
    title: "Discord Community",
    description: "Join the community Discord while the full community pages are still being prepared.",
    purpose: "community",
    icon: "discord",
    availability: "available",
    href: "https://discord.gg/ZjaBEppKY8",
    availabilityNote: null,
    isPrimary: false,
    sortOrder: 80,
    isPublished: true
  },
  {
    id: "00000000-0000-4000-8000-000000000108",
    key: "support",
    title: "Support",
    description: "A support destination can be added after its terms and public wording are approved.",
    purpose: "support",
    icon: "support",
    availability: "unavailable",
    href: null,
    availabilityNote: "Support link not available",
    isPrimary: false,
    sortOrder: 90,
    isPublished: true
  },
  {
    id: "00000000-0000-4000-8000-000000000109",
    key: "personal-context",
    title: "Personal Context",
    description: "Creator-provided context about personal circumstances that can affect streams.",
    purpose: "context",
    icon: "context",
    availability: "available",
    href: "/context",
    availabilityNote: null,
    isPrimary: false,
    sortOrder: 100,
    isPublished: true
  },
  {
    id: "00000000-0000-4000-8000-000000000110",
    key: "accountability-and-history",
    title: "Accountability and History",
    description: "The public structure for project history, corrections, and archived outcomes.",
    purpose: "accountability",
    icon: "accountability",
    availability: "available",
    href: "/accountability",
    availabilityNote: null,
    isPrimary: false,
    sortOrder: 110,
    isPublished: true
  },
  {
    id: "00000000-0000-4000-8000-000000000111",
    key: "affiliate-disclosure",
    title: "Affiliate Disclosure",
    description: "How income links will be identified separately from personal recommendations.",
    purpose: "affiliate",
    icon: "affiliate",
    availability: "available",
    href: "/affiliates",
    availabilityNote: null,
    isPrimary: false,
    sortOrder: 120,
    isPublished: true
  },
  {
    id: "00000000-0000-4000-8000-000000000112",
    key: "account",
    title: "Account",
    description: "Sign in, link providers, choose privacy, and manage identities used on stream.",
    purpose: "account",
    icon: "account",
    availability: "available",
    href: "/account",
    availabilityNote: null,
    isPrimary: false,
    sortOrder: 130,
    isPublished: true
  },
  {
    id: "00000000-0000-4000-8000-000000000113",
    key: "layout-lab",
    title: "Layout Lab",
    description: "Preview landing-page directions while the creator site design settles.",
    purpose: "tool",
    icon: "tool",
    availability: "available",
    href: "/gemini-lab",
    availabilityNote: null,
    isPrimary: false,
    sortOrder: 140,
    isPublished: true
  },
  {
    id: "00000000-0000-4000-8000-000000000114",
    key: "rss-updates",
    title: "RSS Updates",
    description: "Public project and blog updates in an open feed.",
    purpose: "feed",
    icon: "feed",
    availability: "available",
    href: "/feed.xml",
    availabilityNote: null,
    isPrimary: false,
    sortOrder: 150,
    isPublished: true
  }
] as const;
const actionItemSeeds = [
  {
    id: "00000000-0000-4000-8000-000000000050",
    title: "Review first core data model",
    description: "Inspect the generated migration before applying it to dev.",
    category: "project",
    decisionKind: "review",
    priority: "normal",
    status: "open",
    streamRelevant: false,
    liveSafe: false,
    sourceType: "project",
    sourceId: projectId,
    sourceLabel: "Maiks.yt V2"
  },
  {
    id: "00000000-0000-4000-8000-000000000051",
    title: "Review center alert",
    description: "Approve a high-priority overlay alert before it can appear center screen.",
    category: "overlay",
    decisionKind: "approve-or-reject",
    priority: "high",
    status: "open",
    streamRelevant: true,
    liveSafe: true,
    sourceType: "overlay",
    sourceId: "main",
    sourceLabel: "Main overlay"
  },
  {
    id: "00000000-0000-4000-8000-000000000052",
    title: "Confirm next build stream",
    description: "Review the draft stream plan before it is announced.",
    category: "schedule",
    decisionKind: "approve-or-reject",
    priority: "normal",
    status: "open",
    streamRelevant: true,
    liveSafe: false,
    sourceType: "stream",
    sourceId: streamSessionId,
    sourceLabel: "Maiks.yt V2 build stream"
  }
] as const;

await database.insert(users).values({
  id: creatorUserId,
  displayName: "Maiks",
  profileVisibility: "public"
}).onDuplicateKeyUpdate({
  set: {
    displayName: "Maiks",
    profileVisibility: "public"
  }
});

await database.insert(linkedAccounts).values({
  id: creatorLinkedAccountId,
  userId: creatorUserId,
  provider: "dev",
  providerAccountId: "maiks-dev",
  displayName: "Maiks",
  allowLogin: true,
  capabilities: ["login", "profile-avatar", "ign-verification"],
  verifiedAt: new Date()
}).onDuplicateKeyUpdate({
  set: {
    displayName: "Maiks",
    allowLogin: true,
    capabilities: ["login", "profile-avatar", "ign-verification"]
  }
});

await database.insert(roles).values({
  id: ownerRoleId,
  key: "owner",
  name: "Owner",
  permissions: ["*"]
}).onDuplicateKeyUpdate({
  set: {
    name: "Owner",
    permissions: ["*"]
  }
});

await database.insert(userRoles).values({
  id: ownerUserRoleId,
  userId: creatorUserId,
  roleId: ownerRoleId
}).onDuplicateKeyUpdate({
  set: {
    userId: creatorUserId,
    roleId: ownerRoleId
  }
});

await database.insert(projects).values({
  id: projectId,
  slug: "maiks-yt-v2",
  title: "Build Maiks.yt V2",
  summary: "Create the stream website and overlay platform foundation.",
  type: "stream-work-project",
  category: "software-project",
  status: "active",
  isPublic: true,
  createdByUserId: creatorUserId
}).onDuplicateKeyUpdate({
  set: {
    title: "Build Maiks.yt V2",
    status: "active",
    isPublic: true
  }
});

await database.insert(projectMilestones).values({
  id: milestoneId,
  projectId,
  title: "Create the first tested overlay/control loop",
  status: "active",
  sortOrder: 1
}).onDuplicateKeyUpdate({
  set: {
    title: "Create the first tested overlay/control loop",
    status: "active",
    sortOrder: 1
  }
});

await database.insert(projectItems).values({
  id: projectItemId,
  projectId,
  title: "First overlay/control vertical slice",
  description: "A non-monetary work item used to test project item display before support features exist.",
  kind: "task",
  status: "active",
  quantity: 1,
  sortOrder: 1
}).onDuplicateKeyUpdate({
  set: {
    title: "First overlay/control vertical slice",
    status: "active",
    sortOrder: 1
  }
});

await database.insert(projectItemLinks).values({
  id: projectItemLinkId,
  projectItemId,
  provider: "internal",
  url: "https://web-dev.maiks.yt/",
  label: "Dev site",
  relationship: "reference"
}).onDuplicateKeyUpdate({
  set: {
    url: "https://web-dev.maiks.yt/",
    label: "Dev site"
  }
});

await database.insert(creatorLinks).values([...creatorLinkSeeds]).onDuplicateKeyUpdate({
  set: {
    title: sql`VALUES(title)`,
    description: sql`VALUES(description)`,
    purpose: sql`VALUES(purpose)`,
    icon: sql`VALUES(icon)`,
    availability: sql`VALUES(availability)`,
    href: sql`VALUES(href)`,
    availabilityNote: sql`VALUES(availability_note)`,
    isPrimary: sql`VALUES(is_primary)`,
    sortOrder: sql`VALUES(sort_order)`,
    isPublished: sql`VALUES(is_published)`
  }
});

await database.insert(projects).values([
  {
    id: overlayThemeProjectId,
    slug: "overlay-theme-refresh",
    title: "Overlay Theme Refresh",
    summary: "Prepare a cleaner visual pass for stream overlays without adding new alert behavior.",
    type: "multi-item-build",
    category: "stream-infrastructure",
    status: "planning",
    isPublic: true,
    createdByUserId: creatorUserId
  },
  {
    id: communityProjectId,
    slug: "community-onboarding-notes",
    title: "Community Onboarding Notes",
    summary: "Collect low-pressure public notes that explain how to join and what to expect.",
    type: "milestone-only",
    category: "community",
    status: "active",
    isPublic: true,
    createdByUserId: creatorUserId
  }
]).onDuplicateKeyUpdate({
  set: {
    isPublic: true
  }
});

await database.insert(projectMilestones).values([
  {
    id: overlayThemeMilestoneId,
    projectId: overlayThemeProjectId,
    title: "Pick the first overlay polish targets",
    description: "Choose which visible overlay pieces need a design cleanup before adding new systems.",
    status: "planned",
    sortOrder: 1
  },
  {
    id: communityMilestoneId,
    projectId: communityProjectId,
    title: "Publish a simple community expectation draft",
    description: "Keep the first version friendly, clear, and easy to revise.",
    status: "active",
    sortOrder: 1
  }
]).onDuplicateKeyUpdate({
  set: {
    sortOrder: 1
  }
});

await database.insert(projectItems).values([
  {
    id: overlayThemeItemId,
    projectId: overlayThemeProjectId,
    title: "Inventory current overlay visual rough edges",
    description: "A checklist item for the next overlay polish pass.",
    kind: "task",
    status: "planned",
    quantity: 1,
    sortOrder: 1
  },
  {
    id: communityItemId,
    projectId: communityProjectId,
    title: "Draft community link context",
    description: "Short public copy for Discord/community links, without moderation tooling yet.",
    kind: "task",
    status: "active",
    quantity: 1,
    sortOrder: 1
  }
]).onDuplicateKeyUpdate({
  set: {
    quantity: 1,
    sortOrder: 1
  }
});

await database.insert(streamSessions).values({
  id: streamSessionId,
  title: "Maiks.yt V2 build stream",
  channelKey: "coding",
  hobbyKey: "software",
  status: "draft",
  activeProjectId: projectId
}).onDuplicateKeyUpdate({
  set: {
    title: "Maiks.yt V2 build stream",
    activeProjectId: projectId
  }
});

await database.insert(streamScheduleEntries).values([
  {
    id: upcomingStreamScheduleId,
    title: "Maiks.yt V2 build stream",
    description: "Manual schedule seed for testing the public stream schedule page.",
    startsAt: new Date("2026-06-20T18:00:00.000Z"),
    endsAt: new Date("2026-06-20T20:00:00.000Z"),
    channelKey: "coding",
    topicKey: "maiks-yt",
    themeKey: "default",
    visibility: "public",
    status: "planned",
    createdByUserId: creatorUserId
  },
  {
    id: cancelledStreamScheduleId,
    title: "Late night layout polish",
    description: "Cancelled dev seed so public cancellation wording is easy to inspect.",
    startsAt: new Date("2026-06-21T20:00:00.000Z"),
    endsAt: new Date("2026-06-21T21:30:00.000Z"),
    channelKey: "coding",
    topicKey: "overlays",
    themeKey: "default",
    visibility: "public",
    status: "cancelled",
    cancellationReasonCode: "energy",
    cancellationReason: "I need to save energy and will pick this up another day.",
    createdByUserId: creatorUserId
  }
]).onDuplicateKeyUpdate({
  set: {
    title: sql`VALUES(title)`,
    description: sql`VALUES(description)`,
    startsAt: sql`VALUES(starts_at)`,
    endsAt: sql`VALUES(ends_at)`,
    channelKey: sql`VALUES(channel_key)`,
    topicKey: sql`VALUES(topic_key)`,
    themeKey: sql`VALUES(theme_key)`,
    visibility: sql`VALUES(visibility)`,
    status: sql`VALUES(status)`,
    cancellationReasonCode: sql`VALUES(cancellation_reason_code)`,
    cancellationReason: sql`VALUES(cancellation_reason)`
  }
});

await database.insert(overlayStates).values({
  id: overlayStateId,
  streamSessionId,
  overlayKey: "main",
  scene: "gameplay",
  layout: "default-gameplay",
  theme: "default",
  mode: "live",
  state: {
    chatVisible: true,
    sponsorSlotsVisible: false,
    notificationQueueSize: 0
  }
}).onDuplicateKeyUpdate({
  set: {
    streamSessionId,
    scene: "gameplay",
    layout: "default-gameplay",
    theme: "default",
    mode: "live",
    state: {
      chatVisible: true,
      sponsorSlotsVisible: false,
      notificationQueueSize: 0
    }
  }
});

await database.insert(valueSources).values({
  id: "00000000-0000-4000-8000-000000000060",
  key: "manual-eur",
  label: "Manual Euro Entry",
  provider: "manual",
  sourceType: "manual",
  valueKind: "money",
  currencyCode: "EUR",
  payoutEligible: false,
  enabled: false,
  notes: "Planning-only source for future money design. Disabled in V1."
}).onDuplicateKeyUpdate({
  set: {
    enabled: false
  }
});

await database.insert(valueSources).values({
  id: "00000000-0000-4000-8000-000000000061",
  key: "twitch-restricted-credit",
  label: "Twitch Restricted Credit",
  provider: "twitch",
  sourceType: "platform",
  valueKind: "restricted-credit",
  currencyCode: "EUR",
  payoutEligible: false,
  enabled: false,
  notes: "Future platform-derived support that cannot be paid out."
}).onDuplicateKeyUpdate({
  set: {
    enabled: false
  }
});

await database.insert(valueSources).values({
  id: "00000000-0000-4000-8000-000000000062",
  key: "non-monetary-progress",
  label: "Non-monetary Progress",
  provider: "internal",
  sourceType: "internal",
  valueKind: "non-monetary",
  payoutEligible: false,
  enabled: true
}).onDuplicateKeyUpdate({
  set: {
    enabled: true
  }
});

await database.insert(eventReplaySessions).values({
  id: replaySessionId,
  title: "Basic notification replay",
  description: "Seed replay for testing overlay notification behavior.",
  source: "fixture",
  sanitized: true
}).onDuplicateKeyUpdate({
  set: {
    title: "Basic notification replay",
    sanitized: true
  }
});

const existingReplayEvents = await database.select({ id: eventReplayEvents.id })
  .from(eventReplayEvents)
  .where(eq(eventReplayEvents.replaySessionId, replaySessionId));

if (existingReplayEvents.length === 0) {
  await database.insert(eventReplayEvents).values({
    id: randomUUID(),
    replaySessionId,
    eventType: "overlay.notification.queued",
    offsetMs: 0,
    sortOrder: 1,
    payload: {
      id: randomUUID(),
      title: "Test notification",
      message: "The simulator can send a notification.",
      zone: "top",
      priority: "normal"
    }
  });
}

const existingActionItems = await database.select({ id: actionItems.id })
  .from(actionItems)
  .where(inArray(actionItems.id, actionItemSeeds.map(({ id }) => id)));
const existingActionItemIds = new Set(existingActionItems.map(({ id }) => id));
const missingActionItems = actionItemSeeds.filter(({ id }) => !existingActionItemIds.has(id));

if (missingActionItems.length > 0) {
  await database.insert(actionItems).values(missingActionItems);
}

await pool.end();

console.log("Seeded V2 development data.");
