#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);

const activeReadinessFiles = [
  "apps/web/src/app/admin/testing/page.tsx",
  "reports/current-work.md",
  "reports/dev-manual-testing-guide.md",
  "reports/next-agent-tasks.md",
  "scripts/dev-smoke/config.mjs",
  "scripts/dev-smoke/checks.mjs"
];

const stalePatterns = [
  /\b44-check\b/i,
  /\b44 checks\b/i,
  /\b76 passing checks\b/i,
  /\b76\/76\b/i,
  /\b76-check\b/i,
  /\b75 passing checks\b/i,
  /\b75\/75\b/i,
  /\b75-check\b/i
];

const failures = [];

for (const file of activeReadinessFiles) {
  const absolutePath = resolve(repoRoot, file);
  const contents = await readFile(absolutePath, "utf8");
  const lines = contents.split(/\r?\n/);

  lines.forEach((line, index) => {
    const matchedPattern = stalePatterns.find((pattern) => pattern.test(line));

    if (matchedPattern) {
      failures.push({
        file,
        line: index + 1,
        text: line.trim()
      });
    }
  });
}

if (failures.length > 0) {
  console.error("Readiness docs contain stale smoke-count wording:");

  for (const failure of failures) {
    console.error(`- ${failure.file}:${failure.line}: ${failure.text}`);
  }

  process.exitCode = 1;
} else {
  console.log("Readiness docs passed.");
}
