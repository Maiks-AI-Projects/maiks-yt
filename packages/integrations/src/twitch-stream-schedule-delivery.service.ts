import {
  twitchChannelMetadataDeliveryScope,
  twitchScheduleDeliveryScope,
  type TwitchHelixScheduleSegment,
  type TwitchHelixTransportResponse,
  type TwitchStreamScheduleDeliveryInput,
  type TwitchStreamScheduleDeliveryResult,
  type TwitchStreamScheduleDeliveryTransport
} from "./twitch-stream-schedule-delivery.types.js";

const twitchApiBaseUrl = "https://api.twitch.tv/helix";
const maxTwitchTitleLength = 140;
const minScheduleDurationMinutes = 30;
const maxScheduleDurationMinutes = 1_380;

const normalizeText = (value: string | null | undefined, maxLength = 191): string =>
  value?.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength).trim() ?? "";

const parseDate = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseRetryAfter = (value: string | null): number | null => {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(Math.trunc(seconds), 86_400);
  }
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.max(1, Math.min(Math.ceil((date - Date.now()) / 1_000), 86_400));
};

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
};

const createTransportResponse = async (
  response: Response,
  payloadExpected: boolean
): Promise<TwitchHelixTransportResponse<unknown>> => {
  if (!response.ok) {
    return {
      ok: false,
      retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")),
      status: response.status
    };
  }

  return {
    ok: true,
    payload: payloadExpected ? await parseJson(response) : null,
    retryAfterSeconds: null,
    status: response.status
  };
};

const createEmptyTransportResponse = (
  response: Response
): TwitchHelixTransportResponse<null> => {
  if (!response.ok) {
    return {
      ok: false,
      retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")),
      status: response.status
    };
  }

  return {
    ok: true,
    payload: null,
    retryAfterSeconds: null,
    status: response.status
  };
};

export const createTwitchStreamScheduleDeliveryTransport = (): TwitchStreamScheduleDeliveryTransport => ({
  async createScheduleSegment(input) {
    const url = new URL(`${twitchApiBaseUrl}/schedule/segment`);
    url.searchParams.set("broadcaster_id", input.broadcasterId);
    const response = await fetch(url, {
      body: JSON.stringify({
        duration: input.durationMinutes,
        is_recurring: false,
        start_time: input.startsAt,
        timezone: input.timezone,
        title: input.title,
        ...(input.categoryId ? { category_id: input.categoryId } : {})
      }),
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "client-id": input.clientId,
        "content-type": "application/json"
      },
      method: "POST"
    });

    return createTransportResponse(response, true);
  },

  async updateChannelInformation(input) {
    const url = new URL(`${twitchApiBaseUrl}/channels`);
    url.searchParams.set("broadcaster_id", input.broadcasterId);
    const response = await fetch(url, {
      body: JSON.stringify({
        ...(input.categoryId ? { game_id: input.categoryId } : {}),
        title: input.title
      }),
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "client-id": input.clientId,
        "content-type": "application/json"
      },
      method: "PATCH"
    });

    return createEmptyTransportResponse(response);
  },

  async updateScheduleSegment(input) {
    const url = new URL(`${twitchApiBaseUrl}/schedule/segment`);
    url.searchParams.set("broadcaster_id", input.broadcasterId);
    url.searchParams.set("id", input.segmentId);
    const response = await fetch(url, {
      body: JSON.stringify({
        duration: input.durationMinutes,
        start_time: input.startsAt,
        timezone: input.timezone,
        title: input.title,
        ...(input.categoryId ? { category_id: input.categoryId } : {})
      }),
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "client-id": input.clientId,
        "content-type": "application/json"
      },
      method: "PATCH"
    });

    return createTransportResponse(response, true);
  }
});

const failure = (
  outcome: "unsupported" | "degraded" | "failed",
  reason: string,
  message: string,
  retryAfterSeconds: number | null = null
): TwitchStreamScheduleDeliveryResult => ({
  ok: false,
  outcome,
  reason,
  message,
  ...(retryAfterSeconds ? { retryAfterSeconds } : {})
});

const sanitizeRetry = (value: number | null | undefined): number | null =>
  Number.isFinite(value) && typeof value === "number" && value > 0
    ? Math.min(Math.trunc(value), 86_400)
    : null;

const classifyProviderFailure = (
  response: TwitchHelixTransportResponse<unknown>,
  unsupportedOnForbidden: boolean
): TwitchStreamScheduleDeliveryResult => {
  const retryAfterSeconds = sanitizeRetry(response.retryAfterSeconds);

  if (response.status === 429 || response.status === 409) {
    return failure("degraded", "twitch-provider-rate-limited", "Twitch asked us to retry this delivery later.", retryAfterSeconds ?? 300);
  }
  if (response.status === null || response.status >= 500) {
    return failure("degraded", "twitch-provider-unavailable", "Twitch delivery is temporarily unavailable.", retryAfterSeconds ?? 300);
  }
  if (response.status === 401) {
    return failure("failed", "twitch-auth-invalid", "Twitch rejected the configured broadcaster credential.");
  }
  if (response.status === 403) {
    return unsupportedOnForbidden
      ? failure("unsupported", "twitch-schedule-segment-unsupported", "Twitch did not accept a non-recurring schedule segment for this broadcaster.")
      : failure("failed", "twitch-permission-denied", "Twitch rejected the broadcaster permission for this delivery.");
  }

  return failure("failed", "twitch-provider-rejected", "Twitch rejected this delivery.");
};

const hasScope = (
  scopes: readonly string[],
  requiredScope: string
): boolean => scopes.includes(requiredScope);

const resolveDurationMinutes = (input: {
  endsAt: string | null;
  startsAt: string;
}): number | null => {
  if (!input.endsAt) return null;
  const startsAt = parseDate(input.startsAt);
  const endsAt = parseDate(input.endsAt);
  if (!startsAt || !endsAt || endsAt <= startsAt) return null;
  const minutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  return minutes >= minScheduleDurationMinutes && minutes <= maxScheduleDurationMinutes
    ? minutes
    : null;
};

const getDataArray = (value: unknown): readonly unknown[] | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = (value as { data?: unknown }).data;
  return Array.isArray(data) ? data : null;
};

const extractSegment = (payload: unknown): TwitchHelixScheduleSegment | null => {
  const item = getDataArray(payload)?.[0];
  return item && typeof item === "object" && !Array.isArray(item)
    ? item as TwitchHelixScheduleSegment
    : null;
};

const normalizeProviderId = (value: unknown): string | null =>
  typeof value === "string" && normalizeText(value) ? normalizeText(value) : null;

export class TwitchStreamScheduleDeliveryService {
  private readonly supportsOneOffScheduleSegments: boolean;
  private readonly transport: TwitchStreamScheduleDeliveryTransport;

  public constructor(options: {
    supportsOneOffScheduleSegments?: boolean;
    transport?: TwitchStreamScheduleDeliveryTransport;
  } = {}) {
    this.supportsOneOffScheduleSegments = options.supportsOneOffScheduleSegments ?? true;
    this.transport = options.transport ?? createTwitchStreamScheduleDeliveryTransport();
  }

  public async deliver(input: TwitchStreamScheduleDeliveryInput): Promise<TwitchStreamScheduleDeliveryResult> {
    const title = normalizeText(input.schedule.title, maxTwitchTitleLength);
    if (!title) {
      return failure("failed", "twitch-delivery-title-missing", "Twitch delivery requires a non-empty title.");
    }
    if (!input.context?.accessToken || !input.context.clientId || !input.context.broadcasterId) {
      return failure("failed", "twitch-auth-missing", "Twitch broadcaster credentials are not configured.");
    }
    if (input.context.broadcasterId !== input.providerChannelId) {
      return failure("failed", "twitch-token-owner-mismatch", "The Twitch credential does not belong to the target broadcaster.");
    }

    return input.operation === "channel-metadata"
      ? this.updateChannelMetadata(input, title)
      : this.deliverScheduleSegment(input, title);
  }

  private async deliverScheduleSegment(
    input: TwitchStreamScheduleDeliveryInput,
    title: string
  ): Promise<TwitchStreamScheduleDeliveryResult> {
    if (!hasScope(input.context?.scopes ?? [], twitchScheduleDeliveryScope)) {
      return failure("failed", "twitch-schedule-scope-missing", `Twitch consent is missing ${twitchScheduleDeliveryScope}.`);
    }
    if (!input.currentProviderState.providerResourceId && !this.supportsOneOffScheduleSegments) {
      return failure("unsupported", "twitch-schedule-segment-unsupported", "This Twitch provider contract cannot truthfully create a non-recurring schedule segment.");
    }

    const durationMinutes = resolveDurationMinutes(input.schedule);
    if (durationMinutes === null) {
      return failure("failed", "twitch-schedule-duration-invalid", "Twitch schedule delivery requires a valid duration between 30 and 1380 minutes.");
    }

    try {
      const categoryId = normalizeProviderId(input.currentProviderState.providerCategoryId);
      const existingSegmentId = normalizeProviderId(input.currentProviderState.providerResourceId);
      const response = existingSegmentId
        ? await this.transport.updateScheduleSegment({
          accessToken: input.context?.accessToken ?? "",
          broadcasterId: input.providerChannelId,
          categoryId,
          clientId: input.context?.clientId ?? "",
          durationMinutes,
          segmentId: existingSegmentId,
          startsAt: new Date(input.schedule.startsAt).toISOString(),
          timezone: "UTC",
          title
        })
        : await this.transport.createScheduleSegment({
          accessToken: input.context?.accessToken ?? "",
          broadcasterId: input.providerChannelId,
          categoryId,
          clientId: input.context?.clientId ?? "",
          durationMinutes,
          startsAt: new Date(input.schedule.startsAt).toISOString(),
          timezone: "UTC",
          title
        });

      if (!response.ok) {
        return classifyProviderFailure(response, !existingSegmentId);
      }

      const segment = extractSegment(response.payload);
      const segmentId = normalizeProviderId(segment?.id) ?? existingSegmentId;
      if (!segmentId) {
        return failure("failed", "twitch-schedule-receipt-missing", "Twitch did not return a usable schedule segment receipt.");
      }

      return {
        ok: true,
        providerActionId: `twitch-schedule-segment:${segmentId}`,
        receipt: {
          providerCategoryId: normalizeProviderId(segment?.category_id) ?? categoryId,
          providerResourceId: segmentId,
          providerStreamId: input.currentProviderState.providerStreamId
        }
      };
    } catch {
      return failure("degraded", "twitch-provider-unavailable", "Twitch delivery is temporarily unavailable.", 300);
    }
  }

  private async updateChannelMetadata(
    input: TwitchStreamScheduleDeliveryInput,
    title: string
  ): Promise<TwitchStreamScheduleDeliveryResult> {
    if (!hasScope(input.context?.scopes ?? [], twitchChannelMetadataDeliveryScope)) {
      return failure("failed", "twitch-broadcast-scope-missing", `Twitch consent is missing ${twitchChannelMetadataDeliveryScope}.`);
    }

    try {
      const categoryId = normalizeProviderId(input.currentProviderState.providerCategoryId);
      const response = await this.transport.updateChannelInformation({
        accessToken: input.context?.accessToken ?? "",
        broadcasterId: input.providerChannelId,
        categoryId,
        clientId: input.context?.clientId ?? "",
        title
      });

      if (!response.ok) {
        return classifyProviderFailure(response, false);
      }

      return {
        ok: true,
        providerActionId: `twitch-channel-metadata:${input.providerChannelId}`,
        receipt: {
          providerCategoryId: categoryId,
          providerResourceId: input.currentProviderState.providerResourceId,
          providerStreamId: input.currentProviderState.providerStreamId
        }
      };
    } catch {
      return failure("degraded", "twitch-provider-unavailable", "Twitch delivery is temporarily unavailable.", 300);
    }
  }
}
