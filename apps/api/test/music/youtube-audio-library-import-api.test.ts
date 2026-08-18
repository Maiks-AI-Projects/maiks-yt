import Fastify from "fastify";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { DatabasePool } from "@maiks-yt/database";
import {
  youtubeAudioLibraryManifestVersion,
  type YouTubeAudioLibraryValidatedTrack
} from "@maiks-yt/domain/music";

import { registerMusicRoutes } from "../../src/music/music.route.js";
import { createMusicYouTubeAudioLibraryImportRepository } from "../../src/music/music-youtube-audio-library-import-store.service.js";
import { MusicYouTubeAudioLibraryImportService } from "../../src/music/music-youtube-audio-library-import.service.js";
import type {
  MusicYouTubeAudioLibraryImportApplyInput,
  MusicYouTubeAudioLibraryImportRepository,
  MusicYouTubeAudioLibraryImportState,
  MusicYouTubeAudioLibraryImportSummary
} from "../../src/music/music-youtube-audio-library-import.types.js";

const validManifestTrack = (overrides: Record<string, unknown> = {}) => ({
  externalId: "ytal-1",
  title: "Clean Arc",
  artist: "Studio Artist",
  durationSeconds: 120,
  licenseName: "Creative Commons Attribution 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  attributionRequired: true,
  attributionText: "Clean Arc by Studio Artist is licensed under CC BY 4.0.",
  audio: {
    storageRef: "music-audio:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:clean-arc.mp3",
    sha256: "a".repeat(64),
    mimeType: "audio/mpeg"
  },
  proof: {
    url: "https://artist.example.com/source/clean-arc"
  },
  studioEvidence: {
    studioUrl: "https://studio.youtube.com/channel/example/music",
    dialogText: "Clean Arc by Studio Artist is licensed under Creative Commons Attribution 4.0. Source: YouTube Studio Audio Library.",
    attributionText: "Clean Arc by Studio Artist is licensed under CC BY 4.0.",
    licenseText: "Creative Commons Attribution 4.0",
    sourceText: "Source: YouTube Studio Audio Library",
    sourceUrl: "https://artist.example.com/source/clean-arc",
    proofUrl: "https://artist.example.com/source/clean-arc"
  },
  ...overrides
});

const fullExportCompleteness = (tracksExported: number, overrides: Record<string, unknown> = {}) => ({
  reachedEnd: true,
  hitMaxTracks: false,
  visibleRows: tracksExported,
  candidateRows: tracksExported,
  processedCandidates: tracksExported,
  skippedCandidates: 0,
  skipReasons: {},
  tracksExported,
  filterApplied: true,
  refreshMode: "full",
  ...overrides
});

const validManifest = (tracks: readonly Record<string, unknown>[], overrides: Record<string, unknown> = {}) => ({
  manifestVersion: youtubeAudioLibraryManifestVersion,
  source: "youtube-studio",
  refreshMode: "full",
  exportedAt: "2026-08-18T10:00:00.000Z",
  exportCompleteness: fullExportCompleteness(tracks.length),
  tracks,
  ...overrides
});

const emptySummary = (): MusicYouTubeAudioLibraryImportSummary => ({
  received: 0,
  accepted: 0,
  rejected: 0,
  created: 0,
  updated: 0,
  unchanged: 0,
  markedUnavailable: 0,
  licenseSnapshotsAppended: 0
});

class FakeImportRepository implements MusicYouTubeAudioLibraryImportRepository {
  public state: MusicYouTubeAudioLibraryImportState = {
    providerPolicyId: "policy",
    sources: []
  };
  public applied: MusicYouTubeAudioLibraryImportApplyInput | null = null;

  public async getImportState(): Promise<MusicYouTubeAudioLibraryImportState> {
    return structuredClone(this.state);
  }

  public async applyImport(input: MusicYouTubeAudioLibraryImportApplyInput): Promise<MusicYouTubeAudioLibraryImportSummary> {
    this.applied = structuredClone(input);
    return {
      ...emptySummary(),
      received: input.manifest.tracks.length,
      accepted: input.tracks.length,
      rejected: input.manifest.tracks.length - input.tracks.length,
      created: input.tracks.length,
      licenseSnapshotsAppended: input.tracks.length
    };
  }
}

const createService = (
  repository: FakeImportRepository,
  audioVerifier = {
    verify: async () => ({
      ok: true as const,
      contentType: "audio/mpeg"
    })
  },
  now = () => new Date("2026-08-18T12:00:00.000Z")
) =>
  new MusicYouTubeAudioLibraryImportService({
    resolveActor: async () => ({
      domainUserId: "domain-user",
      rolePermissionValues: [JSON.stringify(["music:manage"])]
    })
  }, repository, audioVerifier, now);

const comparableLicensePayload = (track: Record<string, unknown>) => ({
  manifestVersion: youtubeAudioLibraryManifestVersion,
  source: "youtube-studio",
  externalId: track.externalId,
  licenseName: track.licenseName,
  licenseUrl: track.licenseUrl,
  attributionRequired: track.attributionRequired,
  attributionText: track.attributionText,
  proofUrl: (track.proof as { url?: string }).url,
  proofStorageRef: null,
  studioEvidence: track.studioEvidence
});

const buildTinyWav = (): Buffer => {
  const sampleRate = 8_000;
  const durationSeconds = 1;
  const bitsPerSample = 16;
  const channels = 1;
  const dataSize = sampleRate * durationSeconds * channels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
};

describe("YouTube Audio Library import service", () => {
  it("filters non-CC rows and rows missing attribution or audio before apply", async () => {
    const repository = new FakeImportRepository();
    const result = await createService(repository).apply("auth-user", validManifest([
      validManifestTrack(),
      validManifestTrack({
        externalId: "standard",
        licenseName: "YouTube Audio Library License",
        licenseUrl: "https://www.youtube.com/audiolibrary"
      }),
      validManifestTrack({
        externalId: "missing-attribution",
        attributionText: ""
      }),
      validManifestTrack({
        externalId: "missing-audio",
        audio: null
      }),
      validManifestTrack({
        externalId: "missing-proof",
        proof: null
      })
    ], {
      refreshMode: "partial",
      exportCompleteness: undefined
    }));

    expect(result).toMatchObject({
      ok: true,
      mode: "apply",
      summary: {
        received: 5,
        accepted: 1,
        rejected: 4,
        created: 1
      }
    });
    expect(repository.applied?.tracks.map((track) => track.externalId)).toEqual(["ytal-1"]);
    expect(result.ok && result.rejectedTracks.map((track) => track.reason)).toEqual([
      "not_cc_by_4",
      "missing_attribution",
      "missing_audio",
      "missing_license_evidence"
    ]);
  });

  it("does not apply a full refresh when every row is rejected", async () => {
    const repository = new FakeImportRepository();
    const result = await createService(repository).apply("auth-user", validManifest([
      validManifestTrack({
        externalId: "standard-only",
        licenseName: "YouTube Audio Library License",
        licenseUrl: "https://www.youtube.com/audiolibrary"
      }),
      validManifestTrack({
        externalId: "missing-proof",
        proof: null
      })
    ]));

    expect(result).toEqual({
      ok: false,
      reason: "music_import_incomplete_manifest"
    });
    expect(repository.applied).toBeNull();
  });

  it("does not apply an incomplete full exporter manifest", async () => {
    const repository = new FakeImportRepository();
    const result = await createService(repository).apply("auth-user", validManifest([validManifestTrack()], {
      exportCompleteness: {
        reachedEnd: false,
        hitMaxTracks: true,
        visibleRows: 100,
        candidateRows: 100,
        processedCandidates: 1,
        skippedCandidates: 0,
        skipReasons: {},
        tracksExported: 1,
        filterApplied: true,
        refreshMode: "partial"
      }
    }));

    expect(result).toEqual({
      ok: false,
      reason: "music_import_incomplete_manifest"
    });
    expect(repository.applied).toBeNull();
  });

  it("does not allow full refresh semantics without positive exporter completeness evidence", async () => {
    const repository = new FakeImportRepository();

    await expect(createService(repository).apply("auth-user", {
      ...validManifest([validManifestTrack()]),
      exportCompleteness: undefined
    })).resolves.toEqual({
      ok: false,
      reason: "music_import_incomplete_manifest"
    });
    await expect(createService(repository).apply("auth-user", validManifest([validManifestTrack()], {
      exportCompleteness: fullExportCompleteness(1, {
        filterApplied: false
      })
    }))).resolves.toEqual({
      ok: false,
      reason: "music_import_incomplete_manifest"
    });
    await expect(createService(repository).apply("auth-user", validManifest([validManifestTrack()], {
      exportCompleteness: fullExportCompleteness(2)
    }))).resolves.toEqual({
      ok: false,
      reason: "music_import_incomplete_manifest"
    });
    expect(repository.applied).toBeNull();
  });

  it("rejects stale or future-dated manifests before import", async () => {
    const repository = new FakeImportRepository();

    await expect(createService(repository).apply("auth-user", validManifest([validManifestTrack()], {
      exportedAt: "2026-08-10T11:59:59.000Z"
    }))).resolves.toEqual({
      ok: false,
      reason: "music_import_stale_manifest"
    });
    await expect(createService(repository).apply("auth-user", validManifest([validManifestTrack()], {
      exportedAt: "2026-08-18T12:11:00.000Z"
    }))).resolves.toEqual({
      ok: false,
      reason: "music_import_future_manifest"
    });
    expect(repository.applied).toBeNull();
  });

  it("rejects dry-runs and applies when local audio cannot be server-verified", async () => {
    const repository = new FakeImportRepository();
    const verifier = {
      verify: async ({ sha256 }: { sha256: string }) => sha256 !== "a".repeat(64)
        ? {
          ok: true as const,
          contentType: "audio/mpeg"
        }
        : {
          ok: false as const
        }
    };

    await expect(createService(repository, verifier).dryRun("auth-user", validManifest([validManifestTrack()]))).resolves.toEqual({
      ok: false,
      reason: "music_import_audio_unverified"
    });
    await expect(createService(repository, verifier).apply("auth-user", validManifest([validManifestTrack()]))).resolves.toEqual({
      ok: false,
      reason: "music_import_audio_unverified"
    });
    expect(repository.applied).toBeNull();
  });

  it("uses server-detected audio MIME instead of trusting the manifest MIME", async () => {
    const repository = new FakeImportRepository();
    const verifier = {
      verify: async () => ({
        ok: true as const,
        contentType: "audio/wav"
      })
    };

    const result = await createService(repository, verifier).apply("auth-user", validManifest([
      validManifestTrack({
        audio: {
          storageRef: "music-audio:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:clean-arc.wav",
          sha256: "a".repeat(64),
          mimeType: "audio/mpeg"
        }
      })
    ]));

    expect(result.ok).toBe(true);
    expect(repository.applied?.tracks[0]?.audio.mimeType).toBe("audio/wav");
  });

  it("dry-runs idempotency, metadata updates, and disappeared full-refresh sources", async () => {
    const repository = new FakeImportRepository();
    const unchanged = validManifestTrack();
    repository.state = {
      providerPolicyId: "policy",
      sources: [
        {
          sourceId: "source-existing",
          trackId: "track-existing",
          externalId: "ytal-1",
          title: "Clean Arc",
          artist: "Studio Artist",
          durationSeconds: 120,
          reviewState: "review",
          rightsState: "eligible",
          liveSafe: true,
          vodSafe: true,
          explicitContent: false,
          instrumental: false,
          safetyTags: ["youtube-audio-library", "cc-by-4.0"],
          sourceType: "local_audio",
          sourceUrl: null,
          storageRef: "music-audio:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:clean-arc.mp3",
          sha256: "a".repeat(64),
          mimeType: "audio/mpeg",
          availabilityStatus: "available",
          attributionText: "Clean Arc by Studio Artist is licensed under CC BY 4.0.",
          latestLicenseComparable: JSON.stringify({
            title: "Clean Arc",
            artist: "Studio Artist",
            durationSeconds: 120,
            sourceType: "local_audio",
            sourceUrl: null,
            storageRef: "music-audio:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:clean-arc.mp3",
            sha256: "a".repeat(64),
            mimeType: "audio/mpeg",
            attributionText: "Clean Arc by Studio Artist is licensed under CC BY 4.0.",
            safetyTags: ["youtube-audio-library", "cc-by-4.0"],
            explicitContent: false,
            instrumental: false,
            licenseName: "Creative Commons Attribution 4.0",
            licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
            proofUrl: "https://artist.example.com/source/clean-arc",
            proofStorageRef: null,
            licensePayload: comparableLicensePayload(unchanged)
          })
        },
        {
          sourceId: "source-old",
          trackId: "track-old",
          externalId: "old-missing",
          title: "Old Missing",
          artist: "Studio Artist",
          durationSeconds: 90,
          reviewState: "blacklisted",
          rightsState: "eligible",
          liveSafe: true,
          vodSafe: true,
          explicitContent: false,
          instrumental: false,
          safetyTags: ["youtube-audio-library"],
          sourceType: "local_audio",
          sourceUrl: null,
          storageRef: "music-audio:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:old.mp3",
          sha256: "b".repeat(64),
          mimeType: "audio/mpeg",
          availabilityStatus: "available",
          attributionText: "Old Missing by Studio Artist is licensed under CC BY 4.0.",
          latestLicenseComparable: null
        }
      ]
    };

    const result = await createService(repository).dryRun("auth-user", validManifest([
      unchanged,
      validManifestTrack({
        externalId: "ytal-2",
        title: "New Track",
        audio: {
          storageRef: "music-audio:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc:new.mp3",
          sha256: "c".repeat(64),
          mimeType: "audio/mpeg"
        }
      })
    ]));

    expect(result).toMatchObject({
      ok: true,
      mode: "dry-run",
      summary: {
        received: 2,
        accepted: 2,
        rejected: 0,
        created: 1,
        unchanged: 1,
        markedUnavailable: 1
      }
    });
    expect(result.ok && result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ externalId: "ytal-1", action: "unchanged" }),
      expect.objectContaining({ externalId: "ytal-2", action: "create" }),
      expect.objectContaining({ externalId: "old-missing", action: "mark_unavailable" })
    ]));
  });
});

describe("YouTube Audio Library import routes", () => {
  it("requires auth and returns safe validation errors", async () => {
    const server = Fastify({ logger: false });
    registerMusicRoutes(server, {
      getAuthSession: async () => null,
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createImportService: () => ({
        dryRun: async () => ({ ok: false, reason: "music_import_invalid_manifest" }),
        apply: async () => ({ ok: false, reason: "music_import_invalid_manifest" })
      })
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/music/imports/youtube-audio-library/dry-run",
      payload: {
        manifest: {
          secret: "private-file-path-should-not-leak"
        }
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).not.toContain("private-file-path-should-not-leak");
  });

  it("uploads audio through an opaque storage ref without exposing paths", async () => {
    const server = Fastify({ logger: false });
    registerMusicRoutes(server, {
      getAuthSession: async () => ({ user: { id: "auth-user" } }),
      getDatabasePool: () => {
        throw new Error("database should not be used");
      },
      createAudioUploadService: () => ({
        upload: async () => ({
          ok: true,
          upload: {
            storageRef: "music-audio:hash:track.mp3",
            filename: "track.mp3",
            contentType: "audio/mpeg",
            sizeBytes: 12,
            sha256: "a".repeat(64)
          }
        })
      })
    });

    const response = await server.inject({
      method: "POST",
      url: "/admin/music/imports/audio",
      payload: {
        filename: "/tmp/private/track.mp3",
        contentType: "audio/mpeg",
        dataBase64: Buffer.from("audio").toString("base64")
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("music-audio:hash:track.mp3");
    expect(response.body).not.toContain("/tmp/private");
  });
});

describe("music audio storage verifier", () => {
  it("rejects arbitrary uploaded bytes and stores detected audio metadata for supported audio", async () => {
    const previousStorageDir = process.env.MUSIC_AUDIO_STORAGE_DIR;
    const storageDir = await mkdtemp(path.join(tmpdir(), "maiks-music-upload-"));

    try {
      process.env.MUSIC_AUDIO_STORAGE_DIR = storageDir;
      vi.resetModules();
      const { MusicAudioUploadService } = await import("../../src/music/music-audio-upload.service.js");
      const service = new MusicAudioUploadService({
        resolveActor: async () => ({
          domainUserId: "domain-user",
          rolePermissionValues: [JSON.stringify(["music:manage"])]
        })
      });

      await expect(service.upload({
        authUserId: "auth-user",
        filename: "not-audio.mp3",
        contentType: "audio/mpeg",
        dataBase64: Buffer.from("not actually audio").toString("base64")
      })).resolves.toEqual({
        ok: false,
        reason: "music_audio_upload_invalid_input"
      });

      const wav = buildTinyWav();
      const sha256 = createHash("sha256").update(wav).digest("hex");
      await expect(service.upload({
        authUserId: "auth-user",
        filename: "tiny.wav",
        contentType: "audio/mpeg",
        dataBase64: wav.toString("base64")
      })).resolves.toMatchObject({
        ok: true,
        upload: {
          contentType: "audio/wav",
          sha256,
          storageRef: `music-audio:${sha256}:tiny.wav`
        }
      });
    } finally {
      if (previousStorageDir === undefined) {
        delete process.env.MUSIC_AUDIO_STORAGE_DIR;
      } else {
        process.env.MUSIC_AUDIO_STORAGE_DIR = previousStorageDir;
      }
      await rm(storageDir, { force: true, recursive: true });
    }
  });

  it("fails closed for nonexistent and mismatched local audio storage refs", async () => {
    const previousStorageDir = process.env.MUSIC_AUDIO_STORAGE_DIR;
    const storageDir = await mkdtemp(path.join(tmpdir(), "maiks-music-audio-"));

    try {
      const bytes = buildTinyWav();
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const mismatchedSha256 = "b".repeat(64);
      await writeFile(path.join(storageDir, `${sha256}.bin`), bytes);
      await writeFile(path.join(storageDir, `${mismatchedSha256}.bin`), Buffer.from("not b hash"));

      process.env.MUSIC_AUDIO_STORAGE_DIR = storageDir;
      vi.resetModules();
      const { MusicAudioStorageVerificationService } = await import("../../src/music/music-audio-upload.service.js");
      const verifier = new MusicAudioStorageVerificationService();

      await expect(verifier.verify({
        storageRef: `music-audio:${sha256}:verified.mp3`,
        sha256
      })).resolves.toMatchObject({
        ok: true,
        contentType: "audio/wav"
      });
      await expect(verifier.verify({
        storageRef: `music-audio:${"c".repeat(64)}:missing.mp3`,
        sha256: "c".repeat(64)
      })).resolves.toEqual({
        ok: false
      });
      await expect(verifier.verify({
        storageRef: `music-audio:${mismatchedSha256}:mismatch.mp3`,
        sha256: mismatchedSha256
      })).resolves.toEqual({
        ok: false
      });
      await expect(verifier.verify({
        storageRef: `music-audio:${sha256}:verified.mp3`,
        sha256: "d".repeat(64)
      })).resolves.toEqual({
        ok: false
      });
    } finally {
      if (previousStorageDir === undefined) {
        delete process.env.MUSIC_AUDIO_STORAGE_DIR;
      } else {
        process.env.MUSIC_AUDIO_STORAGE_DIR = previousStorageDir;
      }
      await rm(storageDir, { force: true, recursive: true });
    }
  });
});

describe("YouTube Audio Library transactional repository", () => {
  it("updates imported tracks without overwriting existing review state", async () => {
    const executed: string[] = [];
    let began = false;
    let committed = false;
    const connection = {
      beginTransaction: async () => {
        began = true;
      },
      commit: async () => {
        committed = true;
      },
      rollback: async () => undefined,
      release: () => undefined,
      execute: async (sql: string) => {
        executed.push(sql);

        if (sql.includes("FROM music_provider_policies") && sql.includes("SELECT id")) {
          return [[{ id: "policy" }]];
        }

        if (sql.includes("FROM music_track_sources sources")) {
          return [[{
            sourceId: "source-existing",
            trackId: "track-existing",
            externalId: "ytal-1",
            title: "Old Title",
            artist: "Studio Artist",
            durationSeconds: 120,
            reviewState: "blacklisted",
            rightsState: "eligible",
            liveSafe: 1,
            vodSafe: 1,
            explicitContent: 0,
            instrumental: 0,
            safetyTags: JSON.stringify(["youtube-audio-library"]),
            sourceType: "local_audio",
            sourceUrl: null,
            storageRef: "music-audio:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:old.mp3",
            sha256: "a".repeat(64),
            mimeType: "audio/mpeg",
            availabilityStatus: "available",
            attributionText: "Old attribution",
            licenseName: "Creative Commons Attribution 4.0",
            proofUrl: "https://artist.example.com/source/clean-arc",
            proofStorageRef: null,
            licensePayload: JSON.stringify({
              licenseUrl: "https://creativecommons.org/licenses/by/4.0/"
            })
          }]];
        }

        return [[]];
      }
    };
    const repository = createMusicYouTubeAudioLibraryImportRepository({
      getConnection: async () => connection
    } as unknown as DatabasePool);
    const valid = validManifestTrack() as unknown as YouTubeAudioLibraryValidatedTrack;

    await repository.applyImport({
      actorUserId: "domain-user",
      manifest: validManifest([validManifestTrack()]),
      tracks: [valid]
    });

    const trackUpdateSql = executed.find((sql) => sql.includes("UPDATE music_tracks")) ?? "";
    const providerPolicyUpdateSql = executed.find((sql) => sql.includes("UPDATE music_provider_policies")) ?? "";

    expect(trackUpdateSql).not.toContain("review_state");
    expect(providerPolicyUpdateSql).not.toContain("provider_status");
    expect(providerPolicyUpdateSql).not.toContain("rights_state");
    expect(providerPolicyUpdateSql).not.toContain("public_requests_enabled");
    expect(providerPolicyUpdateSql).not.toContain("public_playback_enabled");
    expect(providerPolicyUpdateSql).not.toContain("default_live_safe");
    expect(providerPolicyUpdateSql).not.toContain("default_vod_safe");
    expect(providerPolicyUpdateSql).not.toContain("local_cache_allowed");
    expect(began).toBe(true);
    expect(committed).toBe(true);
  });
});
