#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import {
  PRODUCTION_IMAGE_NAME,
  assertProductionImageLabels,
  collectProductionImageMetadata,
  metadataToComposeEnv,
  parseDockerImageLabels,
} from "./production-image-provenance.mjs";

const { rootDir, metadata } = collectProductionImageMetadata();

console.log(`Building ${PRODUCTION_IMAGE_NAME} from ${metadata.revision}`);
console.log(`Source: ${metadata.source}`);
console.log(`Created: ${metadata.created}`);

const buildResult = spawnSync(
  "docker",
  ["compose", "-f", "docker-compose.production.yml", "build", "web"],
  {
    cwd: rootDir,
    env: {
      ...process.env,
      ...metadataToComposeEnv(metadata),
    },
    stdio: "inherit",
  },
);

if (buildResult.status !== 0) {
  const detail = buildResult.error ? `: ${buildResult.error.message}` : "";
  throw new Error(`Production image build failed${detail}`);
}

const labelsOutput = execFileSync(
  "docker",
  ["image", "inspect", PRODUCTION_IMAGE_NAME, "--format", "{{json .Config.Labels}}"],
  {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  },
);

const labels = parseDockerImageLabels(labelsOutput);
assertProductionImageLabels(labels, metadata);

console.log(`Verified OCI provenance labels on ${PRODUCTION_IMAGE_NAME}.`);
