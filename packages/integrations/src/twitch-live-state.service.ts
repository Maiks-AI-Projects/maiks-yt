import type {
  TwitchLiveStateBroadcasterIdentity,
  TwitchLiveStateConfig,
  TwitchLiveStateHelixStream,
  TwitchLiveStateHelixStreamResult,
  TwitchLiveStateHelixTransport,
  TwitchLiveStateObservationInput,
  TwitchLiveStateObservationResult,
  TwitchLiveStateResolveInput,
  TwitchLiveStateResolveResult
} from "./twitch-live-state.types.js";

const twitchTokenUrl = "https://id.twitch.tv/oauth2/token";
const helixBaseUrl = "https://api.twitch.tv/helix";
const defaultStateCacheTtlMs = 30_000;
const defaultIdentityCacheTtlMs = 5 * 60_000;
const defaultAccessTokenExpirySkewMs = 60_000;
const maxAccessTokenCacheTtlMs = 24 * 60 * 60_000;

type CachedAppAccessToken = {
  accessToken: string;
  expiresAt: Date;
};

type CachedIdentity = {
  broadcaster: TwitchLiveStateBroadcasterIdentity;
  expiresAt: Date;
};

type CachedState = {
  broadcaster: TwitchLiveStateBroadcasterIdentity;
  checkedAt: Date;
  expiresAt: Date;
  observedAt: Date;
  source: "eventsub_cache" | "helix";
  state: "live" | "offline";
};

const trimToNull = (value: string | null | undefined, maxLength = 191): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const normalizeTwitchLogin = (value: string | null | undefined): string | null => {
  const trimmed = trimToNull(value?.replace(/^#/, ""));
  return trimmed ? trimmed.toLowerCase() : null;
};

const isLikelyTwitchUserId = (value: string): boolean => /^[0-9]+$/.test(value);

const parseDate = (value: Date | string | null | undefined): Date | null | "invalid" => {
  if (value == null) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? "invalid" : parsed;
};

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
};

const getDataArray = (value: unknown): readonly unknown[] | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const data = (value as { data?: unknown }).data;
  return Array.isArray(data) ? data : null;
};

const asBroadcasterIdentity = (value: unknown): TwitchLiveStateBroadcasterIdentity | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const id = (value as { id?: unknown }).id;
  const login = (value as { login?: unknown }).login;

  if (typeof id !== "string" || typeof login !== "string") {
    return null;
  }

  const normalizedId = trimToNull(id);
  const normalizedLogin = normalizeTwitchLogin(login);

  return normalizedId && normalizedLogin
    ? { id: normalizedId, login: normalizedLogin }
    : null;
};

const asStream = (value: unknown): TwitchLiveStateHelixStream | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const userId = (value as { user_id?: unknown }).user_id;
  const type = (value as { type?: unknown }).type;
  const startedAt = (value as { started_at?: unknown }).started_at;

  if (typeof userId !== "string" || !trimToNull(userId)) {
    return null;
  }

  return {
    startedAt: typeof startedAt === "string" ? startedAt : null,
    type: typeof type === "string" ? type : null,
    userId: trimToNull(userId) ?? ""
  };
};

export const resolveTwitchLiveStateConfig = (
  env: Record<string, string | undefined>
): TwitchLiveStateConfig | null => {
  const clientId = trimToNull(env.TWITCH_CLIENT_ID);
  const clientSecret = trimToNull(env.TWITCH_CLIENT_SECRET);

  return clientId && clientSecret
    ? { clientId, clientSecret }
    : null;
};

export const createTwitchLiveStateHelixTransport = (): TwitchLiveStateHelixTransport => ({
  async getAppAccessToken(input) {
    try {
      const response = await fetch(twitchTokenUrl, {
        body: new URLSearchParams({
          client_id: input.clientId,
          client_secret: input.clientSecret,
          grant_type: "client_credentials"
        }),
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        method: "POST"
      });

      if (!response.ok) {
        return null;
      }

      const payload = await parseJson(response);
      const accessToken = payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as { access_token?: unknown }).access_token
        : null;
      const expiresInSeconds = payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as { expires_in?: unknown }).expires_in
        : null;

      return typeof accessToken === "string"
        && accessToken.trim()
        && typeof expiresInSeconds === "number"
        && Number.isSafeInteger(expiresInSeconds)
        && expiresInSeconds > 0
        ? { accessToken: accessToken.trim(), expiresInSeconds }
        : null;
    } catch {
      return null;
    }
  },

  async getStreamByUserId(input): Promise<TwitchLiveStateHelixStreamResult> {
    try {
      const url = new URL(`${helixBaseUrl}/streams`);
      url.searchParams.set("user_id", input.broadcasterUserId);
      const response = await fetch(url, {
        headers: {
          authorization: `Bearer ${input.accessToken}`,
          "client-id": input.clientId
        }
      });

      if (!response.ok) {
        return { ok: false };
      }

      const streams = getDataArray(await parseJson(response));
      if (!streams) {
        return { ok: false, reason: "invalid_response" };
      }

      if (streams.length === 0) {
        return { ok: true, stream: null };
      }

      if (streams.length !== 1) {
        return { ok: false, reason: "invalid_response" };
      }

      const stream = asStream(streams[0]);
      if (!stream) {
        return { ok: false, reason: "invalid_response" };
      }

      return {
        ok: true,
        stream
      };
    } catch {
      return { ok: false };
    }
  },

  async getUser(input) {
    try {
      const url = new URL(`${helixBaseUrl}/users`);
      if (input.broadcasterUserId) {
        url.searchParams.set("id", input.broadcasterUserId);
      } else if (input.broadcasterLogin) {
        url.searchParams.set("login", input.broadcasterLogin);
      } else {
        return null;
      }

      const response = await fetch(url, {
        headers: {
          authorization: `Bearer ${input.accessToken}`,
          "client-id": input.clientId
        }
      });

      if (!response.ok) {
        return null;
      }

      return asBroadcasterIdentity(getDataArray(await parseJson(response))?.[0]);
    } catch {
      return null;
    }
  }
});

export class TwitchLiveStateService {
  private readonly accessTokenExpirySkewMs: number;
  private readonly env: Record<string, string | undefined>;
  private readonly getNow: () => Date;
  private readonly identityCacheTtlMs: number;
  private readonly stateCacheTtlMs: number;
  private readonly transport: TwitchLiveStateHelixTransport;
  private readonly appAccessTokenCache = new Map<string, CachedAppAccessToken>();
  private readonly appAccessTokenFlights = new Map<string, Promise<string | null>>();
  private readonly identityCache = new Map<string, CachedIdentity>();
  private readonly identityResolutionFlights = new Map<
    string,
    Promise<TwitchLiveStateBroadcasterIdentity | null>
  >();
  private readonly stateCache = new Map<string, CachedState>();
  private readonly stateResolutionFlights = new Map<string, Promise<TwitchLiveStateResolveResult>>();

  public constructor(options: {
    accessTokenExpirySkewMs?: number;
    env?: Record<string, string | undefined>;
    identityCacheTtlMs?: number;
    now?: () => Date;
    stateCacheTtlMs?: number;
    transport?: TwitchLiveStateHelixTransport;
  } = {}) {
    this.accessTokenExpirySkewMs = options.accessTokenExpirySkewMs ?? defaultAccessTokenExpirySkewMs;
    this.env = options.env ?? process.env;
    this.getNow = options.now ?? (() => new Date());
    this.identityCacheTtlMs = options.identityCacheTtlMs ?? defaultIdentityCacheTtlMs;
    this.stateCacheTtlMs = options.stateCacheTtlMs ?? defaultStateCacheTtlMs;
    this.transport = options.transport ?? createTwitchLiveStateHelixTransport();
  }

  public async resolve(input: TwitchLiveStateResolveInput): Promise<TwitchLiveStateResolveResult> {
    const now = input.now ?? this.getNow();
    const config = resolveTwitchLiveStateConfig(this.env);
    if (!config) {
      return { ok: false, reason: "twitch_live_state_config_missing", state: "unknown" };
    }

    const identityInput = this.normalizeIdentityInput(input);
    if (!identityInput) {
      return { ok: false, reason: "twitch_live_state_identity_missing", state: "unknown" };
    }

    const cached = this.resolveFreshCachedState(identityInput, now);
    if (cached) {
      return this.toResolveResult(cached);
    }

    const accessToken = await this.getAppAccessToken(config);
    if (!accessToken) {
      return { ok: false, reason: "twitch_live_state_api_unavailable", state: "unknown" };
    }

    const broadcaster = await this.resolveBroadcaster({
      accessToken,
      config,
      identityInput,
      now
    });
    if (!broadcaster) {
      return { ok: false, reason: "twitch_live_state_broadcaster_not_found", state: "unknown" };
    }

    const concurrentlyCached = this.getFreshState(broadcaster.id, now);
    if (concurrentlyCached) {
      return this.toResolveResult(concurrentlyCached);
    }

    return await this.resolveStateForBroadcaster({
      accessToken,
      broadcaster,
      config,
      now
    });
  }

  private async resolveStateForBroadcaster(input: {
    accessToken: string;
    broadcaster: TwitchLiveStateBroadcasterIdentity;
    config: TwitchLiveStateConfig;
    now: Date;
  }): Promise<TwitchLiveStateResolveResult> {
    const cached = this.getFreshState(input.broadcaster.id, input.now);
    if (cached) {
      return this.toResolveResult(cached);
    }

    const flightKey = `${input.config.clientId}:${input.broadcaster.id}`;
    const existingFlight = this.stateResolutionFlights.get(flightKey);
    if (existingFlight) {
      return await existingFlight;
    }

    const flight = this.fetchStateFromHelix(input).finally(() => {
      if (this.stateResolutionFlights.get(flightKey) === flight) {
        this.stateResolutionFlights.delete(flightKey);
      }
    });
    this.stateResolutionFlights.set(flightKey, flight);
    return await flight;
  }

  private async fetchStateFromHelix(input: {
    accessToken: string;
    broadcaster: TwitchLiveStateBroadcasterIdentity;
    config: TwitchLiveStateConfig;
    now: Date;
  }): Promise<TwitchLiveStateResolveResult> {
    const lookupStartedAt = this.getNow();
    const streamResult = await this.transport.getStreamByUserId({
      accessToken: input.accessToken,
      broadcasterUserId: input.broadcaster.id,
      clientId: input.config.clientId
    });
    const completedAt = this.getNow();
    const concurrentlyObserved = this.stateCache.get(input.broadcaster.id);
    if (concurrentlyObserved
      && concurrentlyObserved.observedAt.getTime() > lookupStartedAt.getTime()) {
      return concurrentlyObserved.expiresAt.getTime() > completedAt.getTime()
        ? this.toResolveResult(concurrentlyObserved)
        : {
            ok: false,
            reason: "twitch_live_state_newer_observation_stale",
            state: "unknown"
          };
    }

    if (!streamResult.ok) {
      return {
        ok: false,
        reason: streamResult.reason === "invalid_response"
          ? "twitch_live_state_response_invalid"
          : "twitch_live_state_api_unavailable",
        state: "unknown"
      };
    }

    if (streamResult.stream && streamResult.stream.userId !== input.broadcaster.id) {
      return {
        ok: false,
        reason: "twitch_live_state_stream_broadcaster_mismatch",
        state: "unknown"
      };
    }

    if (streamResult.stream && streamResult.stream.type !== "live") {
      return {
        ok: false,
        reason: "twitch_live_state_stream_type_unexpected",
        state: "unknown"
      };
    }

    const state = streamResult.stream ? "live" : "offline";
    const stored = this.storeState({
      broadcaster: input.broadcaster,
      checkedAt: completedAt,
      observedAt: lookupStartedAt,
      source: "helix",
      state
    });

    return {
      ok: true,
      broadcaster: stored.broadcaster,
      checkedAt: stored.checkedAt,
      expiresAt: stored.expiresAt,
      source: stored.source,
      state: stored.state
    };
  }

  public async resolveProviderChannel(input: {
    now?: Date;
    providerChannelId?: string | null;
  }): Promise<TwitchLiveStateResolveResult> {
    const providerChannelId = trimToNull(input.providerChannelId);
    if (!providerChannelId) {
      return { ok: false, reason: "twitch_live_state_identity_missing", state: "unknown" };
    }

    return await this.resolve({
      ...(isLikelyTwitchUserId(providerChannelId)
        ? { broadcasterUserId: providerChannelId }
        : { broadcasterLogin: providerChannelId }),
      ...(input.now ? { now: input.now } : {})
    });
  }

  public recordEventSubObservation(input: TwitchLiveStateObservationInput): TwitchLiveStateObservationResult {
    const eventName = input.providerEventName.toLowerCase();
    const state = eventName === "stream.online"
      ? "live"
      : eventName === "stream.offline" ? "offline" : null;
    if (!state) {
      return { ok: false, reason: "unsupported_event" };
    }

    const observedAt = parseDate(input.observedAt) ?? parseDate(input.receivedAt) ?? this.getNow();
    if (observedAt === "invalid") {
      return { ok: false, reason: "invalid_date" };
    }

    const broadcaster = this.normalizeObservationBroadcaster(input);
    if (!broadcaster) {
      return { ok: false, reason: "missing_identity" };
    }

    const existing = this.stateCache.get(broadcaster.id);
    if (existing && existing.observedAt.getTime() > observedAt.getTime()) {
      return { ok: true, state, stored: false };
    }

    this.storeState({
      broadcaster,
      checkedAt: this.getNow(),
      observedAt,
      source: "eventsub_cache",
      state
    });

    return { ok: true, state, stored: true };
  }

  private getFreshIdentity(cacheKeys: readonly string[], now: Date): TwitchLiveStateBroadcasterIdentity | null {
    for (const cacheKey of cacheKeys) {
      const cached = this.identityCache.get(cacheKey);
      if (cached && cached.expiresAt.getTime() > now.getTime()) {
        return cached.broadcaster;
      }
    }

    return null;
  }

  private async getAppAccessToken(config: TwitchLiveStateConfig): Promise<string | null> {
    const now = this.getNow();
    const cached = this.appAccessTokenCache.get(config.clientId);
    if (cached && cached.expiresAt.getTime() > now.getTime()) {
      return cached.accessToken;
    }

    const existingFlight = this.appAccessTokenFlights.get(config.clientId);
    if (existingFlight) {
      return await existingFlight;
    }

    const flight = this.fetchAppAccessToken(config).finally(() => {
      if (this.appAccessTokenFlights.get(config.clientId) === flight) {
        this.appAccessTokenFlights.delete(config.clientId);
      }
    });
    this.appAccessTokenFlights.set(config.clientId, flight);
    return await flight;
  }

  private async fetchAppAccessToken(config: TwitchLiveStateConfig): Promise<string | null> {
    const result = await this.transport.getAppAccessToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret
    });
    const accessToken = trimToNull(result?.accessToken, 4_096);
    if (!accessToken
      || !result
      || !Number.isSafeInteger(result.expiresInSeconds)
      || result.expiresInSeconds <= 0
      || result.expiresInSeconds > Math.floor(Number.MAX_SAFE_INTEGER / 1_000)) {
      return null;
    }

    const reportedTtlMs = result.expiresInSeconds * 1_000;
    const reusableTtlMs = Math.min(
      Math.max(0, reportedTtlMs - Math.max(0, this.accessTokenExpirySkewMs)),
      maxAccessTokenCacheTtlMs
    );
    if (reusableTtlMs > 0) {
      const cachedAt = this.getNow();
      this.appAccessTokenCache.set(config.clientId, {
        accessToken,
        expiresAt: new Date(cachedAt.getTime() + reusableTtlMs)
      });
    }

    return accessToken;
  }

  private getFreshState(broadcasterUserId: string, now: Date): CachedState | null {
    const cached = this.stateCache.get(broadcasterUserId);
    return cached && cached.expiresAt.getTime() > now.getTime() ? cached : null;
  }

  private resolveFreshCachedState(
    identityInput: NonNullable<ReturnType<TwitchLiveStateService["normalizeIdentityInput"]>>,
    now: Date
  ): CachedState | null {
    if (identityInput.broadcasterUserId) {
      const cachedById = this.getFreshState(identityInput.broadcasterUserId, now);
      if (cachedById) {
        return cachedById;
      }
    }

    const cachedBroadcaster = this.getFreshIdentity(identityInput.cacheKeys, now);
    return cachedBroadcaster
      ? this.getFreshState(cachedBroadcaster.id, now)
      : null;
  }

  private toResolveResult(cached: CachedState): TwitchLiveStateResolveResult {
    return {
      ok: true,
      broadcaster: cached.broadcaster,
      checkedAt: cached.checkedAt,
      expiresAt: cached.expiresAt,
      source: cached.source,
      state: cached.state
    };
  }

  private normalizeIdentityInput(input: TwitchLiveStateResolveInput): {
    cacheKeys: string[];
    broadcasterLogin: string | null;
    broadcasterUserId: string | null;
  } | null {
    const broadcasterUserId = trimToNull(input.broadcasterUserId);
    const broadcasterLogin = normalizeTwitchLogin(input.broadcasterLogin);
    if (!broadcasterUserId && !broadcasterLogin) {
      return null;
    }

    return {
      broadcasterLogin,
      broadcasterUserId,
      cacheKeys: [
        ...(broadcasterUserId ? [`id:${broadcasterUserId}`] : []),
        ...(broadcasterLogin ? [`login:${broadcasterLogin}`] : [])
      ]
    };
  }

  private normalizeObservationBroadcaster(
    input: Pick<TwitchLiveStateObservationInput, "broadcasterLogin" | "broadcasterUserId">
  ): TwitchLiveStateBroadcasterIdentity | null {
    const broadcasterUserId = trimToNull(input.broadcasterUserId);
    const broadcasterLogin = normalizeTwitchLogin(input.broadcasterLogin);
    if (broadcasterUserId) {
      return {
        id: broadcasterUserId,
        login: broadcasterLogin ?? broadcasterUserId
      };
    }

    return broadcasterLogin
      ? { id: `login:${broadcasterLogin}`, login: broadcasterLogin }
      : null;
  }

  private async resolveBroadcaster(input: {
    accessToken: string;
    config: TwitchLiveStateConfig;
    identityInput: NonNullable<ReturnType<TwitchLiveStateService["normalizeIdentityInput"]>>;
    now: Date;
  }): Promise<TwitchLiveStateBroadcasterIdentity | null> {
    const cached = this.getFreshIdentity(input.identityInput.cacheKeys, input.now);
    if (cached) {
      return cached;
    }

    const flightKey = `${input.config.clientId}:${input.identityInput.cacheKeys.join("|")}`;
    const existingFlight = this.identityResolutionFlights.get(flightKey);
    if (existingFlight) {
      return await existingFlight;
    }

    const flight = this.fetchBroadcaster(input).finally(() => {
      if (this.identityResolutionFlights.get(flightKey) === flight) {
        this.identityResolutionFlights.delete(flightKey);
      }
    });
    this.identityResolutionFlights.set(flightKey, flight);
    return await flight;
  }

  private async fetchBroadcaster(input: {
    accessToken: string;
    config: TwitchLiveStateConfig;
    identityInput: NonNullable<ReturnType<TwitchLiveStateService["normalizeIdentityInput"]>>;
    now: Date;
  }): Promise<TwitchLiveStateBroadcasterIdentity | null> {
    const concurrentlyCached = this.getFreshIdentity(input.identityInput.cacheKeys, input.now);
    if (concurrentlyCached) {
      return concurrentlyCached;
    }

    const broadcaster = await this.transport.getUser({
      accessToken: input.accessToken,
      broadcasterLogin: input.identityInput.broadcasterLogin,
      broadcasterUserId: input.identityInput.broadcasterUserId,
      clientId: input.config.clientId
    });
    if (!broadcaster) {
      return null;
    }

    this.storeIdentity(broadcaster, input.now);
    return broadcaster;
  }

  private storeIdentity(broadcaster: TwitchLiveStateBroadcasterIdentity, now: Date): void {
    const cached = {
      broadcaster,
      expiresAt: new Date(now.getTime() + this.identityCacheTtlMs)
    };
    this.identityCache.set(`id:${broadcaster.id}`, cached);
    this.identityCache.set(`login:${broadcaster.login}`, cached);
  }

  private storeState(input: Omit<CachedState, "expiresAt">): CachedState {
    const cached = {
      ...input,
      expiresAt: new Date(input.checkedAt.getTime() + this.stateCacheTtlMs)
    };
    this.stateCache.set(input.broadcaster.id, cached);
    this.storeIdentity(input.broadcaster, input.checkedAt);
    return cached;
  }
}
