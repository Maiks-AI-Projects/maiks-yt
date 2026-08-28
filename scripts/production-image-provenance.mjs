import { execFileSync } from "node:child_process";

export const PRODUCTION_IMAGE_NAME = "maiks-yt-production:local";
export const PRODUCTION_BRANCH = "production";
export const PRODUCTION_SOURCE_URL = "https://github.com/Maiks-AI-Projects/maiks-yt";

const APPROVED_REMOTE_URLS = new Set([
  PRODUCTION_SOURCE_URL,
  `${PRODUCTION_SOURCE_URL}.git`,
  "ssh://git@github.com/Maiks-AI-Projects/maiks-yt",
  "ssh://git@github.com/Maiks-AI-Projects/maiks-yt.git",
  "git@github.com:Maiks-AI-Projects/maiks-yt",
  "git@github.com:Maiks-AI-Projects/maiks-yt.git",
]);

export const OCI_LABELS = Object.freeze({
  title: "org.opencontainers.image.title",
  revision: "org.opencontainers.image.revision",
  source: "org.opencontainers.image.source",
  created: "org.opencontainers.image.created",
});

export const DEFAULT_IMAGE_TITLE = "Maiks.yt Production";

export function isValidFullGitRevision(value) {
  return /^[0-9a-f]{40}$/.test(value);
}

export function formatUtcTimestamp(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    throw new Error("Image creation timestamp must be a valid Date.");
  }

  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function canonicalizeSourceUrl(remoteUrl) {
  const raw = String(remoteUrl ?? "").trim();

  if (raw.length === 0) {
    throw new Error("Git remote origin URL is missing.");
  }

  if (!APPROVED_REMOTE_URLS.has(raw)) {
    throw unsupportedSourceError();
  }

  return PRODUCTION_SOURCE_URL;
}

export function createProductionImageMetadata({ branch, head, status, remoteUrl, now = new Date() }) {
  if (String(branch ?? "").trim() !== PRODUCTION_BRANCH) {
    throw new Error("Production image builds require the exact production branch.");
  }

  const revision = String(head ?? "").trim();

  if (!isValidFullGitRevision(revision)) {
    throw new Error("Git HEAD must be a full 40-character lowercase hexadecimal revision.");
  }

  if (String(status ?? "").trim().length > 0) {
    throw new Error("Refusing to build production image from a dirty Git checkout.");
  }

  return {
    title: DEFAULT_IMAGE_TITLE,
    revision,
    source: canonicalizeSourceUrl(remoteUrl),
    created: formatUtcTimestamp(now),
  };
}

export function collectProductionImageMetadata({ cwd = process.cwd(), now = new Date() } = {}) {
  const rootDir = runGit(cwd, ["rev-parse", "--show-toplevel"]);
  const branch = runGit(rootDir, ["branch", "--show-current"]);
  const head = runGit(rootDir, ["rev-parse", "HEAD"]);
  const status = runGit(rootDir, ["status", "--porcelain=v1", "--untracked-files=normal"]);
  const remoteUrl = runGit(rootDir, ["config", "--get", "remote.origin.url"]);

  return {
    rootDir,
    metadata: createProductionImageMetadata({ branch, head, status, remoteUrl, now }),
  };
}

export function metadataToComposeEnv(metadata) {
  return {
    MAIKS_OCI_TITLE: metadata.title,
    MAIKS_OCI_REVISION: metadata.revision,
    MAIKS_OCI_SOURCE: metadata.source,
    MAIKS_OCI_CREATED: metadata.created,
  };
}

export function expectedLabelsForMetadata(metadata) {
  return {
    [OCI_LABELS.title]: metadata.title,
    [OCI_LABELS.revision]: metadata.revision,
    [OCI_LABELS.source]: metadata.source,
    [OCI_LABELS.created]: metadata.created,
  };
}

export function parseDockerImageLabels(output) {
  const trimmed = String(output ?? "").trim();

  if (trimmed.length === 0) {
    throw new Error("Docker image labels output is empty.");
  }

  const parsed = JSON.parse(trimmed);
  if (parsed === null) {
    return {};
  }

  if (Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Docker image labels output must be a JSON object or null.");
  }

  return parsed;
}

export function verifyProductionImageLabels(labels, metadata) {
  const expectedLabels = expectedLabelsForMetadata(metadata);
  const errors = [];

  for (const [label, expectedValue] of Object.entries(expectedLabels)) {
    if (labels[label] !== expectedValue) {
      errors.push(`${label} expected ${JSON.stringify(expectedValue)} but found ${JSON.stringify(labels[label])}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function assertProductionImageLabels(labels, metadata) {
  const result = verifyProductionImageLabels(labels, metadata);

  if (!result.ok) {
    throw new Error(`Built image provenance labels did not verify:\n${result.errors.join("\n")}`);
  }
}

function unsupportedSourceError() {
  return new Error("Git remote origin must match the approved Maiks.yt source.");
}

function runGit(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
