import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { createDatabase, createDatabasePool } from "./database.service.js";
import { actionItems, eventReplayEvents, eventReplaySessions, projectMilestones, projects, roles, streamSessions, users } from "./database.schema.js";

const pool = createDatabasePool();
const database = createDatabase(pool);

const creatorUserId = "00000000-0000-4000-8000-000000000001";
const ownerRoleId = "00000000-0000-4000-8000-000000000010";
const projectId = "00000000-0000-4000-8000-000000000020";
const milestoneId = "00000000-0000-4000-8000-000000000021";
const streamSessionId = "00000000-0000-4000-8000-000000000030";
const replaySessionId = "00000000-0000-4000-8000-000000000040";

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

await database.insert(actionItems).values({
  id: "00000000-0000-4000-8000-000000000050",
  title: "Review first core data model",
  description: "Inspect the generated migration before applying it to dev.",
  status: "open",
  urgency: "normal",
  category: "development",
  liveSafe: false,
  payload: {
    phase: "core-data-model"
  },
  createdByUserId: creatorUserId
}).onDuplicateKeyUpdate({
  set: {
    status: "open",
    urgency: "normal"
  }
});

await pool.end();

console.log("Seeded V2 development data.");
