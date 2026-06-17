import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { createDatabase, createDatabasePool } from "./database.service.js";
import {
  actionItems,
  eventReplayEvents,
  eventReplaySessions,
  linkedAccounts,
  overlayStates,
  projectItemLinks,
  projectItems,
  projectMilestones,
  projects,
  roles,
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
const replaySessionId = "00000000-0000-4000-8000-000000000040";
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
