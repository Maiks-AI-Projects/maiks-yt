import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../../..");
const auditScript = path.join(repoRoot, "scripts/audit-incompetech-library-import.mjs");
const frozenManifest = "/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/manifests/incompetech-ccby4-20-track-manifest.json";
const frozenManifestSha256 = "a9b84960595facde28c3f6b5183b442dfe31168130052bf46a12996841676ce5";

const sha256Hex = (value: string): string => createHash("sha256").update(value).digest("hex");

const runAudit = (manifestPath: string, expectedSha256: string) => {
  const result = spawnSync(process.execPath, [
    auditScript,
    "--manifest",
    manifestPath,
    "--expected-sha256",
    expectedSha256
  ], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    json: JSON.parse(result.stdout) as {
      ok: boolean;
      reason: string | null;
      counts: {
        totalUniqueSha256: number;
        duplicatesRejected: number;
      };
    }
  };
};

describe("Incompetech audit CLI", () => {
  it("reports exact deterministic counts for the frozen manifest", () => {
    const result = runAudit(frozenManifest, frozenManifestSha256);

    expect(result.status).toBe(0);
    expect(result.json).toMatchObject({
      ok: true,
      reason: null,
      manifestSha256: frozenManifestSha256,
      counts: {
        rightsStatus: {
          "universal-safe": 20
        },
        genre: {
          soundtrack: 4,
          contemporary: 4,
          electronica: 4,
          jazz: 4,
          world: 4
        },
        vocalsClass: {
          none: 20
        },
        totalUniqueSha256: 20,
        duplicatesRejected: 0
      },
      rejectedTracks: [],
      errors: []
    });
  });

  it("fails closed with stable reasons for duplicate content and incomplete evidence", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "maiks-incompetech-audit-"));

    try {
      const manifest = JSON.parse(await readFile(frozenManifest, "utf8")) as {
        tracks: Array<{
          audio: {
            path: string;
            sha256: string;
            storageRef: string;
          };
          directFileUrl?: string;
        }>;
      };
      const duplicate = structuredClone(manifest);
      duplicate.tracks[1].audio = {
        ...duplicate.tracks[1].audio,
        sha256: duplicate.tracks[0].audio.sha256,
        path: duplicate.tracks[0].audio.path,
        storageRef: duplicate.tracks[0].audio.storageRef
      };
      const duplicateJson = `${JSON.stringify(duplicate, null, 2)}\n`;
      const duplicatePath = path.join(dir, "duplicate.json");
      await writeFile(duplicatePath, duplicateJson);

      const duplicateResult = runAudit(duplicatePath, sha256Hex(duplicateJson));
      expect(duplicateResult.status).toBe(1);
      expect(duplicateResult.json).toMatchObject({
        ok: false,
        reason: "duplicate_sha256",
        counts: {
          duplicatesRejected: 1
        }
      });

      const incomplete = structuredClone(manifest);
      delete incomplete.tracks[0].directFileUrl;
      const incompleteJson = `${JSON.stringify(incomplete, null, 2)}\n`;
      const incompletePath = path.join(dir, "incomplete.json");
      await writeFile(incompletePath, incompleteJson);

      const incompleteResult = runAudit(incompletePath, sha256Hex(incompleteJson));
      expect(incompleteResult.status).toBe(1);
      expect(incompleteResult.json).toMatchObject({
        ok: false,
        reason: "unsafe_source_url"
      });
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("fails closed on wrong artist identity and unusable attribution", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "maiks-incompetech-audit-attribution-"));

    try {
      const manifest = JSON.parse(await readFile(frozenManifest, "utf8")) as {
        tracks: Array<{
          artist?: string;
          attributionText?: string;
          title: string;
        }>;
      };
      const cases: Array<{
        name: string;
        mutate: (track: typeof manifest.tracks[number]) => void;
        reason: string;
      }> = [
        {
          name: "wrong-artist",
          mutate: (track) => {
            track.artist = "Someone Else";
          },
          reason: "wrong_artist"
        },
        {
          name: "substring-artist",
          mutate: (track) => {
            track.artist = "Not Kevin MacLeod";
          },
          reason: "wrong_artist"
        },
        {
          name: "placeholder-attribution",
          mutate: (track) => {
            track.attributionText = "placeholder attribution";
          },
          reason: "unusable_attribution"
        },
        {
          name: "missing-title",
          mutate: (track) => {
            track.attributionText = "\"Different Title\" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttp://creativecommons.org/licenses/by/4.0/";
          },
          reason: "unusable_attribution"
        },
        {
          name: "missing-kevin-macleod",
          mutate: (track) => {
            track.attributionText = `"${track.title}" Studio Artist (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttp://creativecommons.org/licenses/by/4.0/`;
          },
          reason: "unusable_attribution"
        },
        {
          name: "missing-incompetech",
          mutate: (track) => {
            track.attributionText = `"${track.title}" Kevin MacLeod\nLicensed under Creative Commons: By Attribution 4.0 License\nhttp://creativecommons.org/licenses/by/4.0/`;
          },
          reason: "unusable_attribution"
        },
        {
          name: "missing-license-url",
          mutate: (track) => {
            track.attributionText = `"${track.title}" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License`;
          },
          reason: "unusable_attribution"
        }
      ];

      for (const testCase of cases) {
        const mutated = structuredClone(manifest);
        testCase.mutate(mutated.tracks[0]);
        const manifestJson = `${JSON.stringify(mutated, null, 2)}\n`;
        const manifestPath = path.join(dir, `${testCase.name}.json`);
        await writeFile(manifestPath, manifestJson);

        const result = runAudit(manifestPath, sha256Hex(manifestJson));
        expect(result.status, testCase.name).toBe(1);
        expect(result.json, testCase.name).toMatchObject({
          ok: false,
          reason: testCase.reason
        });
      }
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  }, 20_000);
});
