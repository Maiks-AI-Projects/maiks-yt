#!/usr/bin/env node
import { basename } from "node:path";
import { readFile } from "node:fs/promises";

import { auditIncompetechManifest } from "./audit-incompetech-library-import.mjs";

const defaultApiBaseUrl = "http://127.0.0.1:3000";
const expectedManifestSha256 = "a9b84960595facde28c3f6b5183b442dfe31168130052bf46a12996841676ce5";

const usage = () => {
  process.stderr.write([
    "Usage: node scripts/import-incompetech-library.mjs --manifest <path> --token <admin-token> [--api-base-url <url>] [--apply]",
    "Runs the deterministic local audit first, uploads local MP3s through /admin/music/imports/audio,",
    "then posts the manifest to /admin/music/imports/incompetech/dry-run unless --apply is present."
  ].join("\n") + "\n");
};

const parseArgs = (argv) => {
  const args = {
    apiBaseUrl: defaultApiBaseUrl,
    apply: false,
    manifestPath: null,
    token: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--manifest") {
      args.manifestPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (value === "--token") {
      args.token = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (value === "--api-base-url") {
      args.apiBaseUrl = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (value === "--apply") {
      args.apply = true;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
};

const postJson = async ({ apiBaseUrl, token, path, body }) => {
  const response = await fetch(new URL(path, apiBaseUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);

  return {
    status: response.status,
    payload
  };
};

const uploadAudio = async ({ apiBaseUrl, token, track }) => {
  const audioPath = track.audio.path;
  const bytes = await readFile(audioPath);
  const uploaded = await postJson({
    apiBaseUrl,
    token,
    path: "/admin/music/imports/audio",
    body: {
      filename: basename(audioPath),
      contentType: track.audio.mimeType,
      dataBase64: bytes.toString("base64")
    }
  });

  if (uploaded.status !== 200
    || !uploaded.payload?.ok
    || uploaded.payload.upload.sha256 !== track.audio.sha256
    || uploaded.payload.upload.contentType !== "audio/mpeg") {
    throw new Error(`Audio upload failed for ${track.externalId}`);
  }

  return uploaded.payload.upload;
};

const main = async () => {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    usage();
    throw error;
  }

  if (!args.manifestPath || !args.token || !args.apiBaseUrl) {
    usage();
    process.exitCode = 2;
    return;
  }

  const audit = await auditIncompetechManifest({
    manifestPath: args.manifestPath,
    expectedManifestSha256
  });
  if (!audit.ok) {
    process.stdout.write(`${JSON.stringify({ ok: false, stage: "audit", audit }, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  const manifest = JSON.parse(await readFile(args.manifestPath, "utf8"));
  const uploads = [];
  for (const track of manifest.tracks) {
    uploads.push(await uploadAudio({
      apiBaseUrl: args.apiBaseUrl,
      token: args.token,
      track
    }));
  }

  const importPath = args.apply
    ? "/admin/music/imports/incompetech/apply"
    : "/admin/music/imports/incompetech/dry-run";
  const result = await postJson({
    apiBaseUrl: args.apiBaseUrl,
    token: args.token,
    path: importPath,
    body: { manifest }
  });

  process.stdout.write(`${JSON.stringify({
    ok: result.status >= 200 && result.status < 300 && result.payload?.ok === true,
    mode: args.apply ? "apply" : "dry-run",
    manifestSha256: audit.manifestSha256,
    uploaded: uploads.length,
    import: result.payload
  }, null, 2)}\n`);
  process.exitCode = result.status >= 200 && result.status < 300 && result.payload?.ok === true ? 0 : 1;
};

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({
    ok: false,
    reason: "import_exception",
    error: error instanceof Error ? error.message : String(error)
  }, null, 2)}\n`);
  process.exitCode = 1;
});
