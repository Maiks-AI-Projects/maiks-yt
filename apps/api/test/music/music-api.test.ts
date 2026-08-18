import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type { DatabasePool } from "@maiks-yt/database";

import { registerMusicRoutes } from "../../src/music/music.route.js";
import { MusicService } from "../../src/music/music.service.js";
import { createMusicRepository } from "../../src/music/music-store.service.js";
import type {
  MusicActor,
  MusicAuthUser,
  MusicBlacklistEntryRecord,
  MusicLicenseSnapshotInput,
  MusicLicenseSnapshotRecord,
  MusicPlaybackOutcomeInput,
  MusicPlayHistoryAppendResult,
  MusicPlayHistoryRecord,
  MusicPlaylistInput,
  MusicPlaylistRecord,
  MusicProviderPolicyInput,
  MusicProviderPolicyRecord,
  MusicRepository,
  MusicReviewQueueRecord,
  MusicSelectableTrack,
  MusicTopTrackPick,
  MusicTrackAdminRecord,
  MusicTrackSourceInput,
  MusicTrackSourceRecord,
  MusicTrackInput,
  MusicTrackRequestCreateResult
} from "../../src/music/index.js";

const nowIso = "2026-08-18T10:00:00.000Z";

const isSafeHttpUrl = (value: string | null): boolean => {
  if (!value) {
    return false;
  }

  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

const createSelectableTrack = (
  id: string,
  overrides: Partial<MusicSelectableTrack> = {}
): MusicSelectableTrack => ({
  id,
  trackId: id,
  sourceId: `${id}-source`,
  title: `Track ${id}`,
  artist: "Artist",
  durationSeconds: 180,
  providerKey: "safe-provider",
  providerName: "Safe Provider",
  sourceType: "external_url",
  sourceLabel: "Catalog",
  sourceExternalId: "external-safe",
  previewUrl: "https://cdn.example.com/preview.mp3",
  previewMimeType: "audio/mpeg",
  sourceUrl: "https://example.com/track",
  sourceStorageRef: null,
  sourceSha256: null,
  safetyTags: ["focus-safe"],
  explicitContent: false,
  instrumental: false,
  attributionText: "Artist via Safe Provider",
  licenseName: "Stream Safe",
  licenseKind: "platform-library",
  licenseUrl: "https://example.com/license",
  providerPolicyUrl: "https://example.com/policy",
  providerTermsUrl: "https://example.com/terms",
  providerPolicyState: "allowed",
  eligibilityState: "eligible",
  reviewState: "unreviewed",
  liveSafe: true,
  vodSafe: true,
  hasActiveBlacklist: false,
  ...overrides
});

class FakeMusicRepository implements MusicRepository {
  public actor: MusicActor | null = {
    domainUserId: "domain-user",
    rolePermissionValues: [["*"]]
  };
  public readonly selectableTracks = new Map<string, MusicSelectableTrack>();
  public readonly requestBuckets = new Set<string>();
  public readonly persistedRequests: Array<{
    anonymousDailyHmac: string;
    amsterdamDate: string;
    providerKey: string;
  }> = [];
  public readonly reviewItems = new Map<string, MusicReviewQueueRecord>();
  public readonly sources = new Map<string, MusicTrackSourceRecord>();
  public readonly licenses = new Map<string, MusicLicenseSnapshotRecord>();
  public replacedTopTracks: readonly { trackId: string; rank: number }[] = [];
  public appendedHistory: Array<{
    outcome: MusicPlaybackOutcomeInput;
    publicVisible: boolean;
  }> = [];

  public constructor() {
    this.selectableTracks.set("safe", createSelectableTrack("safe"));
  }

  public async resolveActor(): Promise<MusicActor | null> {
    return this.actor ? structuredClone(this.actor) : null;
  }

  public async resolveOrCreateDomainUser(authUser: MusicAuthUser): Promise<{ id: string; displayName: string }> {
    return {
      id: `domain-${authUser.id}`,
      displayName: authUser.name ?? "Member"
    };
  }

  public async listPublicCatalog(): Promise<readonly MusicSelectableTrack[]> {
    return [...this.selectableTracks.values()].map((track) => structuredClone(track));
  }

  public async getSelectableTrack(input: {
    trackId: string;
    sourceId: string | null;
  }): Promise<MusicSelectableTrack | null> {
    const track = this.selectableTracks.get(input.trackId);

    if (!track || (input.sourceId && track.sourceId !== input.sourceId)) {
      return null;
    }

    return structuredClone(track);
  }

  public async getAdminPreviewTrack(input: {
    trackId: string;
    sourceId: string | null;
  }): Promise<MusicSelectableTrack | null> {
    const track = this.selectableTracks.get(input.trackId);

    if (!track
      || (input.sourceId && track.sourceId !== input.sourceId)
      || track.hasActiveBlacklist
      || track.eligibilityState === "ineligible"
      || track.providerPolicyState === "disabled"
      || !isSafeHttpUrl(track.previewUrl)
      || !track.previewMimeType) {
      return null;
    }

    return structuredClone(track);
  }

  public async createAnonymousTrackRequest(input: {
    trackId: string;
    sourceId: string;
    providerKey: string;
    anonymousDailyHmac: string;
    amsterdamDate: string;
  }): Promise<MusicTrackRequestCreateResult> {
    const bucketKey = `${input.anonymousDailyHmac}:${input.amsterdamDate}`;

    if (this.requestBuckets.has(bucketKey)) {
      return { ok: false, reason: "music_request_daily_limit" };
    }

    this.requestBuckets.add(bucketKey);
    this.persistedRequests.push({
      anonymousDailyHmac: input.anonymousDailyHmac,
      amsterdamDate: input.amsterdamDate,
      providerKey: input.providerKey
    });

    return {
      ok: true,
      request: {
        id: "request",
        trackId: input.trackId,
        sourceId: input.sourceId,
        status: "pending",
        amsterdamDate: input.amsterdamDate,
        createdAt: nowIso
      }
    };
  }

  public async listTopTracks(): Promise<readonly MusicTopTrackPick[]> {
    return this.replacedTopTracks.map((track) => ({
      trackId: track.trackId,
      rank: track.rank,
      title: this.selectableTracks.get(track.trackId)?.title ?? "Unknown",
      artist: "Artist",
      durationSeconds: 180,
      providerKey: "safe-provider",
      attributionText: "Artist via Safe Provider",
      licenseName: "Stream Safe",
      licenseUrl: "https://example.com/license"
    }));
  }

  public async replaceTopTracks(input: {
    picks: readonly { trackId: string; rank: number }[];
  }): Promise<void> {
    this.replacedTopTracks = structuredClone(input.picks);
  }

  public async listProviderPolicies(): Promise<readonly MusicProviderPolicyRecord[]> {
    return [];
  }

  public async providerPolicyMatchesKey(input: { id: string; providerKey: string }): Promise<boolean> {
    return input.id === "policy" && input.providerKey.toLowerCase() === "safe-provider";
  }

  public async createProviderPolicy(input: MusicProviderPolicyInput & { actorUserId: string }): Promise<MusicProviderPolicyRecord> {
    return {
      id: "policy",
      providerKey: input.providerKey,
      displayName: input.displayName,
      providerType: input.providerType ?? "catalog",
      providerStatus: input.providerStatus ?? "limited",
      rightsState: input.rightsState ?? "uncertain",
      publicRequestsEnabled: input.publicRequestsEnabled ?? false,
      publicPlaybackEnabled: input.publicPlaybackEnabled ?? false,
      defaultLiveSafe: input.defaultLiveSafe ?? false,
      defaultVodSafe: input.defaultVodSafe ?? false,
      attributionRequired: input.attributionRequired ?? true,
      localCacheAllowed: input.localCacheAllowed ?? false,
      policyUrl: input.policyUrl ?? null,
      termsUrl: input.termsUrl ?? null,
      notesPrivate: input.notesPrivate ?? null,
      effectiveFrom: nowIso,
      effectiveUntil: input.effectiveUntil ?? null,
      createdAt: nowIso,
      updatedAt: nowIso
    };
  }

  public async updateProviderPolicy(input: MusicProviderPolicyInput & { id: string; actorUserId: string }): Promise<MusicProviderPolicyRecord | null> {
    return await this.createProviderPolicy(input);
  }

  public async listAdminCatalog(): Promise<readonly MusicTrackAdminRecord[]> {
    return [];
  }

  public async createTrack(input: MusicTrackInput & { actorUserId: string }): Promise<MusicTrackAdminRecord> {
    return createAdminTrack("track", input);
  }

  public async updateTrack(input: MusicTrackInput & { id: string; actorUserId: string }): Promise<MusicTrackAdminRecord | null> {
    return createAdminTrack(input.id, input);
  }

  public async createTrackSource(input: MusicTrackSourceInput & {
    trackId: string;
    actorUserId: string;
  }): Promise<MusicTrackSourceRecord | null> {
    if (!this.selectableTracks.has(input.trackId)) {
      return null;
    }

    const source = createSource("source-created", input.trackId, input);
    this.sources.set(source.id, source);
    return structuredClone(source);
  }

  public async updateTrackSource(input: MusicTrackSourceInput & {
    id: string;
    actorUserId: string;
  }): Promise<MusicTrackSourceRecord | null> {
    const existing = this.sources.get(input.id);

    if (!existing) {
      return null;
    }

    const source = createSource(input.id, existing.trackId, input);
    this.sources.set(source.id, source);
    return structuredClone(source);
  }

  public async createLicenseSnapshot(input: MusicLicenseSnapshotInput & {
    sourceId: string;
    actorUserId: string;
  }): Promise<MusicLicenseSnapshotRecord | null> {
    const source = this.sources.get(input.sourceId);

    if (!source) {
      return null;
    }

    const license = createLicense("license-created", source.trackId, input.sourceId, input);
    this.licenses.set(license.id, license);
    return structuredClone(license);
  }

  public async updateLicenseSnapshot(input: MusicLicenseSnapshotInput & {
    id: string;
    actorUserId: string;
  }): Promise<MusicLicenseSnapshotRecord | null> {
    const existing = this.licenses.get(input.id);

    if (!existing) {
      return null;
    }

    const license = createLicense(input.id, input.trackId ?? existing.trackId, input.sourceId ?? existing.sourceId, input);
    this.licenses.set(license.id, license);
    return structuredClone(license);
  }

  public async listPlaylists(): Promise<readonly MusicPlaylistRecord[]> {
    return [];
  }

  public async createPlaylist(input: MusicPlaylistInput & { actorUserId: string }): Promise<MusicPlaylistRecord> {
    return createPlaylist("playlist", input);
  }

  public async updatePlaylist(input: MusicPlaylistInput & { id: string; actorUserId: string }): Promise<MusicPlaylistRecord | null> {
    return createPlaylist(input.id, input);
  }

  public async replacePlaylistTracks(): Promise<MusicPlaylistRecord | null> {
    return createPlaylist("playlist", { slug: "playlist", title: "Playlist" });
  }

  public async listBlacklistEntries(): Promise<readonly MusicBlacklistEntryRecord[]> {
    return [];
  }

  public async createBlacklistEntry(): Promise<MusicBlacklistEntryRecord> {
    return {
      id: "blacklist",
      scope: "track",
      trackId: "safe",
      sourceId: null,
      providerKey: null,
      normalizedValue: "safe",
      reason: "Safety",
      severity: "permanent",
      createdByUserId: "domain-user",
      revokedByUserId: null,
      revokedAt: null,
      revocationReason: null,
      createdAt: nowIso
    };
  }

  public async revokeBlacklistEntry(): Promise<MusicBlacklistEntryRecord | null> {
    return null;
  }

  public async listReviewQueue(): Promise<readonly MusicReviewQueueRecord[]> {
    return [...this.reviewItems.values()].map((item) => structuredClone(item));
  }

  public async resolveReviewQueueItem(input: {
    id: string;
    action: "keep" | "restrict" | "reject" | "blacklist";
    actorUserId: string;
    note: string | null;
  }): Promise<MusicReviewQueueRecord | null> {
    const item = this.reviewItems.get(input.id);

    if (!item?.trackId) {
      return null;
    }

    if (item.status !== "open" && item.status !== "in_review") {
      return "conflict";
    }

    const track = this.selectableTracks.get(item.trackId);

    if (!track) {
      return null;
    }

    const nextReviewState = input.action === "keep"
      ? track.reviewState === "approved" ? "approved" : "unreviewed"
      : input.action === "restrict"
        ? "restricted"
        : input.action === "reject"
          ? "rejected"
          : "blacklisted";

    this.selectableTracks.set(track.trackId, {
      ...track,
      reviewState: nextReviewState,
      hasActiveBlacklist: input.action === "blacklist" ? true : track.hasActiveBlacklist
    });

    const next = {
      ...item,
      status: input.action === "keep" ? "dismissed" : "resolved",
      resolvedByUserId: input.actorUserId,
      resolvedAt: nowIso,
      details: input.note ?? item.details,
      updatedAt: nowIso
    };
    this.reviewItems.set(input.id, next);

    return structuredClone(next);
  }

  public async listPlayHistory(): Promise<readonly MusicPlayHistoryRecord[]> {
    return [];
  }

  public async appendPlayHistory(input: {
    outcome: MusicPlaybackOutcomeInput;
    publicVisible: boolean;
    trackId: string;
  }): Promise<MusicPlayHistoryAppendResult> {
    const track = this.selectableTracks.get(input.trackId);

    if (!track) {
      return { ok: false, reason: "music_track_not_found" };
    }

    this.appendedHistory.push({
      outcome: input.outcome,
      publicVisible: input.publicVisible
    });

    return {
      ok: true,
      reviewQueued: input.outcome === "skipped" || input.outcome === "queued-skipped",
      history: {
        id: "history",
        trackId: track.trackId,
        sourceId: track.sourceId,
        requestId: null,
        playlistId: null,
        streamSessionId: null,
        startedAt: nowIso,
        endedAt: null,
        outcome: input.outcome,
        outcomeReason: null,
        publicVisible: input.publicVisible,
        titleSnapshot: track.title,
        artistSnapshot: track.artist,
        durationSecondsSnapshot: track.durationSeconds,
        durationPlayedSeconds: null,
        providerKeySnapshot: track.providerKey,
        sourceTypeSnapshot: "external_url",
        sourceLabelSnapshot: track.sourceLabel,
        sourceExternalIdSnapshot: null,
        sourceUrlSnapshot: track.sourceUrl,
        previewUrlSnapshot: track.previewUrl,
        previewMimeTypeSnapshot: track.previewMimeType,
        licenseNameSnapshot: track.licenseName,
        licenseKindSnapshot: track.licenseKind,
        licenseUrlSnapshot: track.licenseUrl,
        providerPolicyUrlSnapshot: track.providerPolicyUrl,
        attributionTextSnapshot: track.attributionText,
        rightsStateSnapshot: track.eligibilityState,
        reviewStateSnapshot: track.reviewState,
        liveSafeSnapshot: track.liveSafe,
        vodSafeSnapshot: track.vodSafe,
        safetyTagsSnapshot: {
          safetyTags: track.safetyTags,
          explicitContent: track.explicitContent,
          instrumental: track.instrumental
        },
        createdAt: nowIso
      }
    };
  }
}

const createAdminTrack = (id: string, input: MusicTrackInput): MusicTrackAdminRecord => ({
  id,
  slug: input.slug,
  title: input.title,
  artist: input.artist,
  album: input.album ?? null,
  durationSeconds: input.durationSeconds ?? null,
  isrc: input.isrc ?? null,
  rightsState: input.rightsState ?? "uncertain",
  reviewState: input.reviewState ?? "unreviewed",
  liveSafe: input.liveSafe ?? false,
  vodSafe: input.vodSafe ?? false,
  explicitContent: input.explicitContent ?? false,
  instrumental: input.instrumental ?? false,
  safetyTags: input.safetyTags ?? [],
  notesPrivate: input.notesPrivate ?? null,
  createdAt: nowIso,
  updatedAt: nowIso,
  sources: [],
  licenseSnapshots: []
});

const createSource = (
  id: string,
  trackId: string,
  input: MusicTrackSourceInput
): MusicTrackSourceRecord => ({
  id,
  trackId,
  providerPolicyId: input.providerPolicyId ?? null,
  providerKey: input.providerKey,
  sourceType: input.sourceType,
  sourceLabel: input.sourceLabel,
  sourceExternalId: input.sourceExternalId ?? null,
  sourceUrl: input.sourceUrl ?? null,
  previewUrl: input.previewUrl ?? null,
  previewMimeType: input.previewMimeType ?? null,
  storageRef: input.storageRef ?? null,
  sha256: input.sha256 ?? null,
  mimeType: input.mimeType ?? null,
  durationSeconds: input.durationSeconds ?? null,
  rightsState: input.rightsState ?? "uncertain",
  availabilityStatus: input.availabilityStatus ?? "available",
  attributionText: input.attributionText ?? null,
  createdAt: nowIso,
  updatedAt: nowIso
});

const createLicense = (
  id: string,
  trackId: string,
  sourceId: string,
  input: MusicLicenseSnapshotInput
): MusicLicenseSnapshotRecord => ({
  id,
  trackId,
  sourceId,
  providerPolicyId: input.providerPolicyId ?? null,
  licenseName: input.licenseName,
  licenseKind: input.licenseKind ?? "unknown",
  rightsState: input.rightsState ?? "uncertain",
  liveSafe: input.liveSafe ?? false,
  vodSafe: input.vodSafe ?? false,
  attributionRequired: input.attributionRequired ?? true,
  attributionText: input.attributionText ?? null,
  proofUrl: input.proofUrl ?? null,
  validFrom: input.validFrom ?? null,
  validUntil: input.validUntil ?? null,
  capturedAt: nowIso
});

const createReviewItem = (id: string, trackId: string): MusicReviewQueueRecord => ({
  id,
  trackId,
  sourceId: `${trackId}-source`,
  requestId: null,
  playHistoryId: null,
  queueKind: "manual_review",
  status: "open",
  priority: "normal",
  reasonCode: "safety",
  summary: "Review track safety.",
  details: null,
  createdByUserId: "domain-user",
  assignedToUserId: null,
  resolvedByUserId: null,
  resolvedAt: null,
  createdAt: nowIso,
  updatedAt: nowIso
});

const createPlaylist = (id: string, input: MusicPlaylistInput): MusicPlaylistRecord => ({
  id,
  slug: input.slug,
  title: input.title,
  description: input.description ?? null,
  visibility: input.visibility ?? "private",
  reviewState: input.reviewState ?? "draft",
  createdAt: nowIso,
  updatedAt: nowIso,
  tracks: []
});

describe("MusicService public catalog", () => {
  it("returns only safe public preview metadata and keeps unreviewed eligible tracks available", async () => {
    const repository = new FakeMusicRepository();
    repository.selectableTracks.set("approved", createSelectableTrack("approved", { reviewState: "approved" }));
    repository.selectableTracks.set("review", createSelectableTrack("review", { reviewState: "review" }));
    repository.selectableTracks.set("blacklisted", createSelectableTrack("blacklisted", { hasActiveBlacklist: true }));
    repository.selectableTracks.set("vod-only", createSelectableTrack("vod-only", { liveSafe: false }));
    const service = new MusicService(repository);

    const result = await service.listPublicCatalog({ query: "", context: "live" });

    expect(result.tracks.map((track) => track.trackId)).toEqual(["safe", "approved"]);
    expect(result.tracks[0]).toMatchObject({
      title: "Track safe",
      artist: "Artist",
      providerKey: "safe-provider",
      liveSafe: true,
      vodSafe: true,
      previewUrl: "https://cdn.example.com/preview.mp3",
      previewMimeType: "audio/mpeg",
      sourceUrl: "https://example.com/track",
      attributionText: "Artist via Safe Provider",
      licenseUrl: null
    });
    expect(result.tracks[0]).not.toHaveProperty("reviewState");
    expect(result.tracks[0]).not.toHaveProperty("hasActiveBlacklist");
    expect(result.tracks[0]).not.toHaveProperty("storageRef");
    expect(result.tracks[0]).not.toHaveProperty("sha256");
  });

  it("gives blacklist precedence over otherwise eligible tracks", async () => {
    const repository = new FakeMusicRepository();
    repository.selectableTracks.set("safe", createSelectableTrack("safe", {
      hasActiveBlacklist: true,
      reviewState: "approved",
      eligibilityState: "eligible"
    }));

    const result = await new MusicService(repository).listPublicCatalog({ query: "", context: "live" });

    expect(result.tracks).toEqual([]);
  });

  it("redacts unsafe public URLs and never exposes private license proof URLs", async () => {
    const repository = new FakeMusicRepository();
    repository.selectableTracks.set("safe", createSelectableTrack("safe", {
      previewUrl: "file:///tmp/private-preview.mp3",
      sourceUrl: "/private/catalog",
      licenseUrl: "https://example.com/private-proof",
      providerPolicyUrl: "ftp://example.com/policy",
      providerTermsUrl: "https://example.com/terms"
    }));

    const result = await new MusicService(repository).listPublicCatalog({ query: "", context: "live" });

    expect(result.tracks[0]).toMatchObject({
      previewUrl: null,
      sourceUrl: null,
      licenseUrl: null,
      providerPolicyUrl: null,
      providerTermsUrl: "https://example.com/terms"
    });
  });
});

describe("MusicService anonymous requests", () => {
  it("enforces one successful anonymous request per hashed IP key per Amsterdam day", async () => {
    const repository = new FakeMusicRepository();
    const service = new MusicService(repository, {
      getRequestHashSecret: () => "test-secret",
      getNow: () => new Date("2026-01-01T23:30:00.000Z")
    });

    const first = await service.createAnonymousRequest({
      trackId: "safe",
      sourceId: "safe-source",
      context: "live",
      viewerIp: "203.0.113.10",
      requestText: "please"
    });
    const second = await service.createAnonymousRequest({
      trackId: "safe",
      sourceId: "safe-source",
      context: "live",
      viewerIp: "203.0.113.10",
      requestText: "again"
    });

    expect(first).toMatchObject({ ok: true });
    expect(second).toEqual({ ok: false, reason: "music_request_daily_limit" });
    expect(repository.persistedRequests[0]?.amsterdamDate).toBe("2026-01-02");
    expect(repository.persistedRequests[0]?.anonymousDailyHmac).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.persistedRequests[0]?.anonymousDailyHmac).not.toContain("203.0.113.10");
  });

  it("rejects non-selectable tracks with a safe error", async () => {
    const repository = new FakeMusicRepository();
    repository.selectableTracks.set("safe", createSelectableTrack("safe", { eligibilityState: "uncertain" }));

    await expect(new MusicService(repository, {
      getRequestHashSecret: () => "test-secret"
    }).createAnonymousRequest({
      trackId: "safe",
      sourceId: "safe-source",
      context: "live",
      viewerIp: "203.0.113.10",
      requestText: null
    })).resolves.toEqual({
      ok: false,
      reason: "music_track_not_selectable"
    });
  });
});

describe("MusicService top tracks", () => {
  it("validates top 10 uniqueness and live-selectable tracks", async () => {
    const repository = new FakeMusicRepository();
    const service = new MusicService(repository, { topTrackLimit: 10 });

    await expect(service.replaceTopTracks({
      authUser: { id: "auth-user", name: "User" },
      tracks: [
        { trackId: "safe", rank: 1 },
        { trackId: "safe", rank: 2 }
      ]
    })).resolves.toEqual({
      ok: false,
      reason: "music_top_tracks_duplicate_track"
    });

    await expect(service.replaceTopTracks({
      authUser: { id: "auth-user", name: "User" },
      tracks: Array.from({ length: 11 }, (_, index) => ({
        trackId: `missing-${index}`,
        rank: index + 1
      }))
    })).resolves.toEqual({
      ok: false,
      reason: "music_top_tracks_limit_exceeded"
    });

    await expect(service.replaceTopTracks({
      authUser: { id: "auth-user", name: "User" },
      tracks: [{ trackId: "safe", rank: 1 }]
    })).resolves.toMatchObject({
      ok: true,
      limit: 10,
      tracks: [{ trackId: "safe", rank: 1 }]
    });
  });
});

describe("MusicService admin music authoring", () => {
  it("creates sources and license snapshots through music:manage", async () => {
    const repository = new FakeMusicRepository();
    const service = new MusicService(repository);

    const sourceResult = await service.createTrackSource("auth-user", "safe", {
      providerPolicyId: "policy",
      providerKey: "safe-provider",
      sourceType: "external_url",
      sourceLabel: "Provider preview",
      sourceExternalId: "provider-123",
      sourceUrl: "https://example.com/catalog-page",
      previewUrl: "https://cdn.example.com/provider-123-preview.mp3",
      previewMimeType: "audio/mpeg",
      rightsState: "eligible",
      availabilityStatus: "available",
      attributionText: "Artist via provider"
    });

    expect(sourceResult).toMatchObject({
      ok: true,
      source: {
        sourceUrl: "https://example.com/catalog-page",
        previewUrl: "https://cdn.example.com/provider-123-preview.mp3",
        previewMimeType: "audio/mpeg"
      }
    });

    const licenseResult = await service.createLicenseSnapshot("auth-user", "source-created", {
      licenseName: "Creator-safe catalog",
      licenseKind: "platform-library",
      rightsState: "eligible",
      liveSafe: true,
      vodSafe: true,
      attributionRequired: true,
      attributionText: "Artist via provider",
      proofUrl: "https://example.com/license-proof"
    });

    expect(licenseResult).toMatchObject({
      ok: true,
      licenseSnapshot: {
        licenseName: "Creator-safe catalog",
        rightsState: "eligible",
        liveSafe: true,
        vodSafe: true
      }
    });
  });

  it("rejects a source whose provider key does not match its policy", async () => {
    const service = new MusicService(new FakeMusicRepository());

    await expect(service.createTrackSource("auth-user", "safe", {
      providerPolicyId: "policy",
      providerKey: "another-provider",
      sourceType: "external_url",
      sourceLabel: "Mismatched source",
      sourceUrl: "https://example.com/catalog-page",
      previewUrl: "https://cdn.example.com/preview.mp3",
      previewMimeType: "audio/mpeg"
    })).resolves.toEqual({
      ok: false,
      reason: "music_provider_policy_mismatch"
    });
  });

  it("resolves reviews with deterministic keep and blacklist actions", async () => {
    const repository = new FakeMusicRepository();
    repository.reviewItems.set("review-keep", createReviewItem("review-keep", "safe"));
    repository.reviewItems.set("review-blacklist", createReviewItem("review-blacklist", "safe"));
    const service = new MusicService(repository);

    await expect(service.resolveReviewQueueItem("auth-user", "review-keep", {
      action: "keep",
      note: "Keep available."
    })).resolves.toMatchObject({
      ok: true,
      reviewItem: {
        status: "dismissed",
        resolvedByUserId: "domain-user"
      }
    });
    expect(repository.selectableTracks.get("safe")?.reviewState).toBe("unreviewed");

    await expect(service.resolveReviewQueueItem("auth-user", "review-blacklist", {
      action: "blacklist",
      note: "Unsafe."
    })).resolves.toMatchObject({
      ok: true,
      reviewItem: {
        status: "resolved"
      }
    });

    const catalog = await service.listPublicCatalog({ query: "", context: "live" });

    expect(repository.selectableTracks.get("safe")).toMatchObject({
      reviewState: "blacklisted",
      hasActiveBlacklist: true
    });
    expect(catalog.tracks).toEqual([]);
  });

  it("returns a conflict for repeated terminal review resolution without changing selection", async () => {
    const repository = new FakeMusicRepository();
    repository.reviewItems.set("review-terminal", {
      ...createReviewItem("review-terminal", "safe"),
      status: "resolved",
      resolvedByUserId: "owner",
      resolvedAt: nowIso
    });
    const before = structuredClone(repository.selectableTracks.get("safe"));

    await expect(new MusicService(repository).resolveReviewQueueItem("auth-user", "review-terminal", {
      action: "blacklist",
      note: "Repeated."
    })).resolves.toEqual({
      ok: false,
      reason: "music_review_conflict"
    });

    expect(repository.selectableTracks.get("safe")).toEqual(before);
  });
});

describe("MusicService play control", () => {
  it("creates review work for skipped outcomes but not stopped outcomes", async () => {
    const repository = new FakeMusicRepository();
    const service = new MusicService(repository);

    await expect(service.appendPlayHistory("auth-user", {
      trackId: "safe",
      sourceId: "safe-source",
      requestId: null,
      playlistId: null,
      streamSessionId: null,
      startedAt: new Date(nowIso),
      endedAt: null,
      outcome: "skipped",
      outcomeReason: "Bad fit",
      durationPlayedSeconds: 5
    })).resolves.toMatchObject({
      ok: true,
      reviewQueued: true
    });

    await expect(service.appendPlayHistory("auth-user", {
      trackId: "safe",
      sourceId: "safe-source",
      requestId: null,
      playlistId: null,
      streamSessionId: null,
      startedAt: new Date(nowIso),
      endedAt: null,
      outcome: "stopped",
      outcomeReason: "Stream ended",
      durationPlayedSeconds: 5
    })).resolves.toMatchObject({
      ok: true,
      reviewQueued: false
    });
  });

  it("forces admin preview history private", async () => {
    const repository = new FakeMusicRepository();
    const service = new MusicService(repository);

    await service.appendPlayHistory("auth-user", {
      trackId: "safe",
      sourceId: "safe-source",
      requestId: null,
      playlistId: null,
      streamSessionId: null,
      startedAt: new Date(nowIso),
      endedAt: null,
      outcome: "admin-preview",
      outcomeReason: null,
      durationPlayedSeconds: null,
      publicVisible: true
    });

    expect(repository.appendedHistory.at(-1)).toEqual({
      outcome: "admin-preview",
      publicVisible: false
    });
  });

  it("stores dedicated preview snapshots in immutable history", async () => {
    const repository = new FakeMusicRepository();
    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [JSON.stringify(["music:play-control"])]
    };
    const service = new MusicService(repository);

    await expect(service.appendPlayHistory("auth-user", {
      trackId: "safe",
      sourceId: "safe-source",
      requestId: null,
      playlistId: null,
      streamSessionId: null,
      startedAt: new Date(nowIso),
      endedAt: null,
      outcome: "played-full",
      outcomeReason: null,
      durationPlayedSeconds: 30
    })).resolves.toMatchObject({
      ok: true,
      history: {
        sourceUrlSnapshot: "https://example.com/track",
        previewUrlSnapshot: "https://cdn.example.com/preview.mp3",
        previewMimeTypeSnapshot: "audio/mpeg",
        safetyTagsSnapshot: {
          safetyTags: ["focus-safe"],
          explicitContent: false,
          instrumental: false
        }
      }
    });
  });

  it("allows admin preview for restricted uncertain tracks with a safe preview", async () => {
    const repository = new FakeMusicRepository();
    repository.selectableTracks.set("safe", createSelectableTrack("safe", {
      eligibilityState: "uncertain",
      reviewState: "restricted",
      providerPolicyState: "review-only",
      liveSafe: false,
      vodSafe: false
    }));
    const service = new MusicService(repository);

    await expect(service.appendPlayHistory("auth-user", {
      trackId: "safe",
      sourceId: "safe-source",
      requestId: null,
      playlistId: null,
      streamSessionId: null,
      startedAt: new Date(nowIso),
      endedAt: null,
      outcome: "admin-preview",
      outcomeReason: null,
      durationPlayedSeconds: null,
      publicVisible: true
    })).resolves.toMatchObject({
      ok: true,
      history: {
        publicVisible: false,
        reviewStateSnapshot: "restricted",
        rightsStateSnapshot: "uncertain"
      }
    });
  });

  it("blocks admin preview when preview URLs are unsafe or the track is blacklisted", async () => {
    const repository = new FakeMusicRepository();
    repository.selectableTracks.set("unsafe-preview", createSelectableTrack("unsafe-preview", {
      previewUrl: "file:///tmp/private.mp3"
    }));
    repository.selectableTracks.set("blacklisted", createSelectableTrack("blacklisted", {
      hasActiveBlacklist: true
    }));
    const service = new MusicService(repository);
    const baseInput = {
      sourceId: null,
      requestId: null,
      playlistId: null,
      streamSessionId: null,
      startedAt: new Date(nowIso),
      endedAt: null,
      outcome: "admin-preview" as const,
      outcomeReason: null,
      durationPlayedSeconds: null
    };

    await expect(service.appendPlayHistory("auth-user", {
      ...baseInput,
      trackId: "unsafe-preview"
    })).resolves.toEqual({
      ok: false,
      reason: "music_track_not_selectable"
    });
    await expect(service.appendPlayHistory("auth-user", {
      ...baseInput,
      trackId: "blacklisted"
    })).resolves.toEqual({
      ok: false,
      reason: "music_track_not_selectable"
    });
  });

  it("enforces music permissions separately for manage and play-control", async () => {
    const repository = new FakeMusicRepository();
    repository.actor = {
      domainUserId: "domain-user",
      rolePermissionValues: [JSON.stringify(["music:manage"])]
    };
    const service = new MusicService(repository);

    await expect(service.listAdmin({ authUserId: "auth-user" })).resolves.toMatchObject({ ok: true });
    await expect(service.appendPlayHistory("auth-user", {
      trackId: "safe",
      sourceId: "safe-source",
      requestId: null,
      playlistId: null,
      streamSessionId: null,
      startedAt: new Date(nowIso),
      endedAt: null,
      outcome: "played-full",
      outcomeReason: null,
      durationPlayedSeconds: null
    })).resolves.toEqual({
      ok: false,
      reason: "music_play_control_forbidden"
    });
  });
});

describe("MusicRepository SQL policy shape", () => {
  it("uses explicit provider policy ids first and only falls back by key when unambiguous and active", async () => {
    const executed: string[] = [];
    const repository = createMusicRepository({
      execute: async (sql) => {
        executed.push(String(sql));
        return [[]];
      }
    } as unknown as DatabasePool);

    await repository.listPublicCatalog({
      query: null,
      context: "live",
      limit: 10
    });

    const sql = executed[0] ?? "";

    expect(sql).toContain("sources.provider_policy_id IS NOT NULL AND policies.id = sources.provider_policy_id");
    expect(sql).toContain("sources.provider_policy_id IS NULL");
    expect(sql).toContain("SELECT COUNT(*)");
    expect(sql).toContain("fallback_policies.effective_from <= NOW()");
    expect(sql).toContain("policies.effective_from <= NOW()");
    expect(sql).not.toContain("policies.id = sources.provider_policy_id\n      OR policies.provider_key");
  });

  it("selects only currently valid latest licenses and has a separate admin-preview path", async () => {
    const executed: string[] = [];
    const repository = createMusicRepository({
      execute: async (sql) => {
        executed.push(String(sql));
        return [[]];
      }
    } as unknown as DatabasePool);

    await repository.getAdminPreviewTrack({
      trackId: "track",
      sourceId: null
    });

    const sql = executed[0] ?? "";

    expect(sql).toContain("latest_licenses.valid_from IS NULL OR latest_licenses.valid_from <= NOW()");
    expect(sql).toContain("latest_licenses.valid_until IS NULL OR latest_licenses.valid_until > NOW()");
    expect(sql).toContain("policies.provider_status IN ('allowed', 'limited')");
    expect(sql).toContain("sources.preview_url IS NOT NULL");
    expect(sql).not.toContain("tracks.review_state IN ('unreviewed', 'approved')");
    expect(sql).not.toContain("policies.public_playback_enabled = TRUE");
  });
});

describe("Music routes", () => {
  it("rejects Spotify policies and sources", async () => {
    const server = Fastify({ logger: false });
    registerMusicRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new MusicService(new FakeMusicRepository())
    });

    const policyResponse = await server.inject({
      method: "POST",
      url: "/admin/music/provider-policies",
      payload: {
        providerKey: "Spotify",
        displayName: "Spotify"
      }
    });
    const sourceResponse = await server.inject({
      method: "POST",
      url: "/admin/music/catalog/safe/sources",
      payload: {
        providerKey: " spotify ",
        sourceType: "external_url",
        sourceLabel: "Spotify source",
        sourceUrl: "https://example.com/catalog-page"
      }
    });

    expect(policyResponse.statusCode).toBe(400);
    expect(sourceResponse.statusCode).toBe(400);
  });

  it("rejects source payloads that treat catalog URLs as previews", async () => {
    const server = Fastify({ logger: false });
    registerMusicRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new MusicService(new FakeMusicRepository())
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/music/catalog/safe/sources",
      payload: {
        providerKey: "safe-provider",
        sourceType: "external_url",
        sourceLabel: "Catalog page",
        sourceUrl: "https://example.com/catalog-page",
        previewUrl: "https://cdn.example.com/preview.mp3"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      ok: false,
      reason: "music_invalid_input"
    });
  });

  it("rejects unsafe admin URL inputs without echoing the value", async () => {
    const server = Fastify({ logger: false });
    registerMusicRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new MusicService(new FakeMusicRepository())
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/music/provider-policies",
      payload: {
        providerKey: "unsafe",
        displayName: "Unsafe Provider",
        policyUrl: "file:///home/michael/private-policy.txt"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("music_invalid_input");
    expect(response.body).not.toContain("private-policy");
  });

  it("prefers the Cloudflare connecting IP inside the documented tunnel boundary", async () => {
    let capturedIp = "";
    const server = Fastify();
    registerMusicRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => ({
        createAnonymousRequest: async (input) => {
          capturedIp = input.viewerIp;
          return {
            ok: false,
            reason: "music_request_daily_limit"
          };
        },
        listPublicCatalog: async () => ({ ok: true, tracks: [] }),
        getTopTracks: async () => ({ ok: true, limit: 10, tracks: [] }),
        replaceTopTracks: async () => ({ ok: true, limit: 10, tracks: [] }),
        listAdmin: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        createProviderPolicy: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        updateProviderPolicy: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        createTrack: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        updateTrack: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        createTrackSource: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        updateTrackSource: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        createLicenseSnapshot: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        updateLicenseSnapshot: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        createPlaylist: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        updatePlaylist: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        replacePlaylistTracks: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        createBlacklistEntry: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        revokeBlacklistEntry: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        resolveReviewQueueItem: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        appendPlayHistory: async () => ({ ok: false, reason: "music_play_control_forbidden" })
      })
    });

    const response = await server.inject({
      method: "POST",
      url: "/music/requests",
      headers: {
        "cf-connecting-ip": "198.51.100.77",
        "x-forwarded-for": "203.0.113.55"
      },
      payload: {
        trackId: "safe",
        sourceId: "safe-source"
      }
    });

    expect(response.statusCode).toBe(429);
    expect(capturedIp).toBe("198.51.100.77");
  });

  it("redacts thrown internal errors from public responses", async () => {
    const server = Fastify({ logger: false });
    registerMusicRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => ({
        listPublicCatalog: async () => {
          throw new Error("secret-token-should-not-leak");
        },
        createAnonymousRequest: async () => ({ ok: false, reason: "music_request_unavailable" }),
        getTopTracks: async () => ({ ok: true, limit: 10, tracks: [] }),
        replaceTopTracks: async () => ({ ok: true, limit: 10, tracks: [] }),
        listAdmin: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        createProviderPolicy: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        updateProviderPolicy: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        createTrack: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        updateTrack: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        createTrackSource: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        updateTrackSource: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        createLicenseSnapshot: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        updateLicenseSnapshot: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        createPlaylist: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        updatePlaylist: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        replacePlaylistTracks: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        createBlacklistEntry: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        revokeBlacklistEntry: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        resolveReviewQueueItem: async () => ({ ok: false, reason: "music_admin_forbidden" }),
        appendPlayHistory: async () => ({ ok: false, reason: "music_play_control_forbidden" })
      })
    });

    const response = await server.inject({
      method: "GET",
      url: "/music/catalog"
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).toContain("music_unavailable");
    expect(response.body).not.toContain("secret-token-should-not-leak");
  });

  it("requires authentication before account and owner music routes", async () => {
    const server = Fastify({ logger: false });
    registerMusicRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createService: () => new MusicService(new FakeMusicRepository())
    });

    const accountResponse = await server.inject({
      method: "GET",
      url: "/account/music/top-tracks"
    });
    const adminResponse = await server.inject({
      method: "GET",
      url: "/admin/music"
    });

    expect(accountResponse.statusCode).toBe(401);
    expect(adminResponse.statusCode).toBe(401);
  });
});
