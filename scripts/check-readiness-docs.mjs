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

const requiredSnippets = [
  {
    file: "apps/web/src/app/admin/testing/page.tsx",
    snippets: [
      "bounded dev API startup wait",
      "79-check dev smoke dry-run"
    ]
  },
  {
    file: "reports/dev-manual-testing-guide.md",
    snippets: [
      "Expected current smoke size: 79 passing checks.",
      "waits for `api-dev` health",
      "transient `502` attempts"
    ]
  },
  {
    file: "reports/next-agent-tasks.md",
    snippets: [
      "bounded dev API health wait",
      "79-check smoke dry-run"
    ]
  }
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

for (const requirement of requiredSnippets) {
  const absolutePath = resolve(repoRoot, requirement.file);
  const contents = await readFile(absolutePath, "utf8");

  for (const snippet of requirement.snippets) {
    if (!contents.includes(snippet)) {
      failures.push({
        file: requirement.file,
        line: 0,
        text: `missing required readiness copy: ${snippet}`
      });
    }
  }
}

if (failures.length > 0) {
  console.error("Readiness docs failed validation:");

  for (const failure of failures) {
    console.error(`- ${failure.file}:${failure.line}: ${failure.text}`);
  }

  process.exitCode = 1;
} else {
  console.log("Readiness docs passed.");
}
