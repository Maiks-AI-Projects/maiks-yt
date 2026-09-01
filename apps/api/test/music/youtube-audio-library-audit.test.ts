import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const auditScriptPath = path.resolve(process.cwd(), "../../scripts/audit-youtube-audio-library-import.mjs");

const loadAuditHelper = async () =>
  await import(new URL("../../../../scripts/audit-youtube-audio-library-import.mjs", import.meta.url).href) as {
    auditYouTubeAudioLibraryImport: (input: {
      manifest: Record<string, unknown>;
      importResult?: Record<string, unknown> | null;
    }) => Record<string, unknown>;
  };

const track = (overrides: Record<string, unknown> = {}) => ({
  externalId: "ytal-1",
  title: "Clean Arc",
  artist: "Studio Artist",
  durationSeconds: 120,
  downloadedAt: "2026-08-18T09:58:00.000Z",
  genre: "cinematic",
  vocalsClass: "none",
  liveSafe: true,
  vodSafe: true,
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
    studioUrl: "https://studio.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa/music",
    dialogText: "Clean Arc by Studio Artist is licensed under Creative Commons Attribution 4.0.",
    attributionText: "Clean Arc by Studio Artist is licensed under CC BY 4.0.",
    licenseText: "Creative Commons Attribution 4.0",
    sourceText: "Source: YouTube Studio Audio Library",
    sourceUrl: "https://artist.example.com/source/clean-arc",
    proofUrl: "https://artist.example.com/source/clean-arc"
  },
  ...overrides
});

const manifest = (tracks: readonly Record<string, unknown>[]) => ({
  manifestVersion: "youtube-audio-library.v1",
  exportedAt: "2026-08-18T10:00:00.000Z",
  refreshMode: "partial",
  source: "youtube-studio",
  tracks
});

const runAuditCli = async (tracks: readonly Record<string, unknown>[]) => {
  const tempDir = await mkdtemp(path.join(tmpdir(), "maiks-youtube-audio-audit-"));
  const manifestPath = path.join(tempDir, "manifest.json");

  try {
    await writeFile(manifestPath, JSON.stringify(manifest(tracks), null, 2), "utf8");
    const result = await execFileAsync(process.execPath, [auditScriptPath, "--manifest", manifestPath], {
      cwd: path.resolve(process.cwd(), "../.."),
      encoding: "utf8"
    });

    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    const failed = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
    };

    return {
      exitCode: failed.code ?? 1,
      stdout: failed.stdout ?? "",
      stderr: failed.stderr ?? ""
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
};

describe("YouTube Audio Library deterministic audit", () => {
  it("reports exact counts by rights status, genre, vocals class, and unique SHA-256", async () => {
    const { auditYouTubeAudioLibraryImport } = await loadAuditHelper();
    const result = auditYouTubeAudioLibraryImport({
      manifest: manifest([
        track(),
        track({
          externalId: "ytal-2",
          genre: "electronic / dance",
          vocalsClass: "minimal",
          audio: {
            storageRef: "music-audio:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:clean-arc-2.mp3",
            sha256: "b".repeat(64),
            mimeType: "audio/mpeg"
          }
        })
      ]),
      importResult: {
        ok: true,
        summary: {
          received: 2,
          accepted: 2,
          rejected: 0
        }
      }
    });

    expect(result).toEqual({
      ok: true,
      counts: {
        received: 2,
        accepted: 2,
        rejected: 0,
        duplicatesRejected: 0,
        totalUniqueSha256: 2,
        byRightsStatus: {
          "universal-safe": 2,
          rejected: 0
        },
        byGenre: {
          cinematic: 1,
          "electronic / dance": 1
        },
        byVocalsClass: {
          minimal: 1,
          none: 1
        }
      },
      rejectedTracks: []
    });
  });

  it("fails instead of inflating counts for duplicate content", async () => {
    const { auditYouTubeAudioLibraryImport } = await loadAuditHelper();
    const result = auditYouTubeAudioLibraryImport({
      manifest: manifest([
        track(),
        track({ externalId: "ytal-duplicate" })
      ])
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "manifest_evidence_incomplete",
      counts: {
        received: 2,
        accepted: 1,
        rejected: 1,
        duplicatesRejected: 1,
        totalUniqueSha256: 1
      },
      rejectedTracks: [{
        index: 1,
        externalId: "ytal-duplicate",
        title: "Clean Arc",
        reason: "duplicate_content"
      }]
    });
  });

  it("fails on incomplete evidence and import result count mismatch", async () => {
    const { auditYouTubeAudioLibraryImport } = await loadAuditHelper();

    expect(auditYouTubeAudioLibraryImport({
      manifest: manifest([
        track({
          externalId: "unknown-vocals",
          vocalsClass: "unknown"
        })
      ])
    })).toMatchObject({
      ok: false,
      reason: "manifest_evidence_incomplete",
      rejectedTracks: [{
        index: 0,
        externalId: "unknown-vocals",
        reason: "unsafe_vocals_class"
      }]
    });

    expect(auditYouTubeAudioLibraryImport({
      manifest: manifest([track()]),
      importResult: {
        ok: true,
        summary: {
          received: 1,
          accepted: 0,
          rejected: 1
        }
      }
    })).toMatchObject({
      ok: false,
      reason: "import_result_count_mismatch"
    });
  });

  it.each([
    ["missing Studio URL", undefined],
    ["malformed Studio URL", "not a url"],
    ["non-HTTPS Studio URL", "http://studio.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa/music"],
    ["wrong Studio host", "https://music.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa/music"],
    ["non-channel Studio music URL", "https://studio.youtube.com/music"],
    ["non-UC Studio channel URL", "https://studio.youtube.com/channel/example/music"],
    ["non-music Studio channel URL", "https://studio.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa/videos"]
  ])("fails the real audit CLI for %s", async (_label, studioUrl) => {
    const studioEvidence = {
      ...(track().studioEvidence as Record<string, unknown>),
      studioUrl
    };
    if (studioUrl === undefined) {
      delete studioEvidence.studioUrl;
    }

    const result = await runAuditCli([
      track({
        studioEvidence
      })
    ]);
    const output = JSON.parse(result.stdout) as {
      ok: boolean;
      reason: string;
      rejectedTracks: Array<{ reason: string }>;
    };

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toBe("");
    expect(output.ok).toBe(false);
    expect(output.reason).toBe("manifest_evidence_incomplete");
    expect(output.rejectedTracks).toEqual([
      expect.objectContaining({
        reason: "missing_license_evidence"
      })
    ]);
  });
});
