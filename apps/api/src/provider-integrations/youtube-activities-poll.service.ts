import { YouTubeActivitiesReadOnlyService } from "@maiks-yt/integrations";

import { getProviderEventCatalogEntry } from "@maiks-yt/domain/events";
import { normalizeProviderIntegrationPermissions } from "./provider-integration-status.service.js";
import type {
  YouTubeActivitiesIntakeWriter,
  YouTubeActivitiesPollActor,
  YouTubeActivitiesPollControlResult,
  YouTubeActivitiesPollRepository,
  YouTubeActivitiesReadOnlyPoller
} from "./youtube-activities-poll.types.js";

const canManageYouTubeActivities = (actor: YouTubeActivitiesPollActor): boolean => {
  const permissions = normalizeProviderIntegrationPermissions(actor.rolePermissionValues);

  return permissions.includes("*") || permissions.includes("provider-integrations:manage");
};

export class YouTubeActivitiesPollControlService {
  public constructor(
    private readonly repository: YouTubeActivitiesPollRepository,
    private readonly intakeWriter: YouTubeActivitiesIntakeWriter,
    private readonly poller: YouTubeActivitiesReadOnlyPoller = new YouTubeActivitiesReadOnlyService()
  ) {}

  public async pollRecent(input: { authUserId: string }): Promise<YouTubeActivitiesPollControlResult> {
    const actor = await this.repository.resolveActor(input.authUserId);

    if (!actor) {
      return {
        ok: false,
        reason: "youtube_activities_user_unlinked"
      };
    }

    if (!canManageYouTubeActivities(actor)) {
      return {
        ok: false,
        reason: "youtube_activities_forbidden"
      };
    }

    const context = await this.repository.resolveSelectedLiveChatContext();

    if (!context) {
      return {
        ok: false,
        reason: "youtube_activities_context_missing"
      };
    }

    const pollResult = await this.poller.pollRecent({ context });

    if (!pollResult.ok) {
      return pollResult;
    }

    const events: Array<Extract<YouTubeActivitiesPollControlResult, { ok: true }>["events"][number]> = [];

    for (const event of pollResult.events) {
      const writeResult = await this.intakeWriter.recordProviderEvent(event);

      if (!writeResult.ok) {
        return {
          ok: false,
          reason: "youtube_activities_write_failed"
        };
      }

      events.push({
        catalogKnown: Boolean(getProviderEventCatalogEntry("youtube", event.providerEventName)),
        inserted: writeResult.inserted,
        providerEventName: event.providerEventName,
        providerMessageId: event.providerMessageId,
        sourceEventId: event.sourceEventId
      });
    }

    return {
      ok: true,
      channelId: pollResult.channelId,
      events,
      fetched: pollResult.events.length,
      inserted: events.filter((event) => event.inserted).length,
      polledAt: pollResult.polledAt,
      readOnly: true
    };
  }
}
