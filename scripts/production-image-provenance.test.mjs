import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_IMAGE_TITLE,
  OCI_LABELS,
  PRODUCTION_BRANCH,
  PRODUCTION_SOURCE_URL,
  canonicalizeSourceUrl,
  createProductionImageMetadata,
  expectedLabelsForMetadata,
  formatUtcTimestamp,
  metadataToComposeEnv,
  parseDockerImageLabels,
  verifyProductionImageLabels,
} from "./production-image-provenance.mjs";

const validHead = "0123456789abcdef0123456789abcdef01234567";
const validRemote = "https://github.com/Maiks-AI-Projects/maiks-yt.git";
const validDate = new Date("2026-08-28T08:09:10.123Z");

function createValidMetadata(overrides = {}) {
  return createProductionImageMetadata({
    branch: PRODUCTION_BRANCH,
    head: validHead,
    status: "",
    remoteUrl: validRemote,
    now: validDate,
    ...overrides,
  });
}

function captureError(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }

  assert.fail("Expected callback to throw.");
}

test("creates verified metadata from a clean checkout state", () => {
  const metadata = createValidMetadata();

  assert.deepEqual(metadata, {
    title: DEFAULT_IMAGE_TITLE,
    revision: validHead,
    source: PRODUCTION_SOURCE_URL,
    created: "2026-08-28T08:09:10Z",
  });
});

test("canonicalizes only approved Maiks.yt remote forms", () => {
  const validForms = [
    "git@github.com:Maiks-AI-Projects/maiks-yt.git",
    "git@github.com:Maiks-AI-Projects/maiks-yt",
    "ssh://git@github.com/Maiks-AI-Projects/maiks-yt.git",
    "ssh://git@github.com/Maiks-AI-Projects/maiks-yt",
    "https://github.com/Maiks-AI-Projects/maiks-yt.git",
    "https://github.com/Maiks-AI-Projects/maiks-yt",
  ];

  for (const remote of validForms) {
    assert.equal(canonicalizeSourceUrl(remote), PRODUCTION_SOURCE_URL);
  }
});

test("requires the exact production branch", () => {
  assert.throws(
    () => createValidMetadata({ branch: "main" }),
    /exact production branch/,
  );
});

test("requires the exact approved source", () => {
  assert.throws(
    () => createValidMetadata({ remoteUrl: "https://github.com/Maiks-AI-Projects/maiks-yt-fork.git" }),
    /approved Maiks\.yt source/,
  );
});

test("rejects HTTPS userinfo without exposing credentials", () => {
  const remote = "https://build-user:top-secret@github.com/Maiks-AI-Projects/maiks-yt.git";
  const error = captureError(() => canonicalizeSourceUrl(remote));

  assert.match(error.message, /approved Maiks\.yt source/);
  assert.equal(error.message.includes(remote), false);
  assert.equal(error.message.includes("top-secret"), false);
});

test("redacts malformed secret-bearing remotes from errors", () => {
  const remote = "://build-user:another-secret@github.com/Maiks-AI-Projects/maiks-yt.git";
  const error = captureError(() => canonicalizeSourceUrl(remote));

  assert.match(error.message, /approved Maiks\.yt source/);
  assert.equal(error.message.includes(remote), false);
  assert.equal(error.message.includes("another-secret"), false);
});

test("rejects scp-like query and fragment poisoning", () => {
  assert.throws(
    () => canonicalizeSourceUrl("git@github.com:Maiks-AI-Projects/maiks-yt.git?token=secret"),
    /approved Maiks\.yt source/,
  );
  assert.throws(
    () => canonicalizeSourceUrl("git@github.com:Maiks-AI-Projects/maiks-yt.git#token=secret"),
    /approved Maiks\.yt source/,
  );
});

test("accepts clean state and rejects tracked or untracked changes", () => {
  assert.equal(createValidMetadata().revision, validHead);
  assert.throws(
    () => createValidMetadata({ status: " M Dockerfile.production\n" }),
    /dirty Git checkout/,
  );
  assert.throws(
    () => createValidMetadata({ status: "?? local-secret.txt\n" }),
    /dirty Git checkout/,
  );
});

test("rejects invalid or abbreviated revisions", () => {
  assert.throws(
    () => createValidMetadata({ head: "ff4b380" }),
    /full 40-character/,
  );
});

test("rejects unsupported source remotes with a fixed error", () => {
  assert.throws(() => canonicalizeSourceUrl("/home/michael/maiks-yt"), /approved Maiks\.yt source/);
  assert.throws(() => canonicalizeSourceUrl("file:///home/michael/maiks-yt"), /approved Maiks\.yt source/);
});

test("formats UTC timestamps without millisecond drift", () => {
  assert.equal(formatUtcTimestamp(validDate), "2026-08-28T08:09:10Z");
  assert.throws(() => formatUtcTimestamp(new Date("invalid")), /valid Date/);
});

test("maps metadata to Compose build args", () => {
  const metadata = createValidMetadata();

  assert.deepEqual(metadataToComposeEnv(metadata), {
    MAIKS_OCI_TITLE: DEFAULT_IMAGE_TITLE,
    MAIKS_OCI_REVISION: validHead,
    MAIKS_OCI_SOURCE: PRODUCTION_SOURCE_URL,
    MAIKS_OCI_CREATED: "2026-08-28T08:09:10Z",
  });
});

test("verifies required image labels exactly", () => {
  const metadata = createValidMetadata();

  assert.deepEqual(verifyProductionImageLabels(expectedLabelsForMetadata(metadata), metadata), {
    ok: true,
    errors: [],
  });
});

test("rejects missing or mismatched image labels", () => {
  const metadata = createValidMetadata();

  const result = verifyProductionImageLabels(
    {
      [OCI_LABELS.title]: DEFAULT_IMAGE_TITLE,
      [OCI_LABELS.revision]: "unverified",
      [OCI_LABELS.source]: metadata.source,
    },
    metadata,
  );

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /org\.opencontainers\.image\.revision/);
  assert.match(result.errors.join("\n"), /org\.opencontainers\.image\.created/);
});

test("parses Docker inspect label output", () => {
  assert.deepEqual(parseDockerImageLabels('{"a":"b"}\n'), { a: "b" });
  assert.deepEqual(parseDockerImageLabels("null"), {});
  assert.throws(() => parseDockerImageLabels("[]"), /JSON object/);
});
