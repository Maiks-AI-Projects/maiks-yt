import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const reportOnly = process.argv.includes("--report-only");
const findings = [];

const allowedRootDirs = new Set(["apps", "ideas", "packages", "reports", "scripts"]);
const bannedJunkDirs = new Set(["models", "services", "types", "utils"]);
const allowedSuffixes = [
  ".config.ts",
  "-data.ts",
  ".events.ts",
  "-gate.ts",
  ".rules.ts",
  ".schema.ts",
  ".service.ts",
  ".state.ts",
  "-token.ts",
  "-transport.ts",
  ".test.ts",
  ".types.ts",
  "-updates.ts",
  ".d.ts",
  "index.ts",
  "main.ts",
  "proxy.ts",
  "route.ts",
  "vite-env.d.ts"
];
const skippedDirs = new Set([".git", ".next", "dist", "dist-types", "node_modules"]);

function addFinding(severity, ruleId, message, filePath = null) {
  findings.push({
    filePath,
    message,
    ruleId,
    severity
  });
}

function runGit(args, fallback = "unknown") {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim() || fallback;
  } catch {
    return fallback;
  }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (skippedDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function toRepoPath(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
}

function checkTopLevel(repoPath) {
  const [top] = repoPath.split("/");
  if (!top || repoPath.startsWith(".")) {
    return;
  }

  if (repoPath.includes("/") && !allowedRootDirs.has(top)) {
    addFinding("blocking", "ARCH001", `Unexpected top-level folder "${top}".`, repoPath);
  }
}

function checkJunkFolders(repoPath) {
  const parts = repoPath.split("/");
  const bad = parts.find((part) => bannedJunkDirs.has(part));
  if (bad) {
    addFinding("blocking", "ARCH002", `Avoid broad "${bad}" folders; organize by domain instead.`, repoPath);
  }
}

function checkTypeScriptName(repoPath) {
  if (!repoPath.endsWith(".ts") && !repoPath.endsWith(".tsx")) {
    return;
  }

  if (repoPath.endsWith(".tsx")) {
    return;
  }

  const fileName = repoPath.split("/").at(-1);
  if (!fileName || allowedSuffixes.some((suffix) => fileName.endsWith(suffix))) {
    return;
  }

  addFinding(
    "blocking",
    "ARCH003",
    "TypeScript file should use a known suffix or be intentionally added to the checker.",
    repoPath
  );
}

async function checkForbiddenImports(filePath, repoPath) {
  if (!repoPath.endsWith(".ts") && !repoPath.endsWith(".tsx")) {
    return;
  }

  const text = await readFile(filePath, "utf8");

  if (repoPath.startsWith("packages/domain/") && text.includes("@maiks-yt/ui")) {
    addFinding("blocking", "ARCH004", "Domain package must not import UI.", repoPath);
  }

  if (repoPath.startsWith("packages/events/") && text.includes("apps/")) {
    addFinding("blocking", "ARCH005", "Events package must not depend on app code.", repoPath);
  }
}

function checkTrackedGeneratedFiles() {
  const trackedFiles = runGit(["ls-files"], "")
    .split(/\r?\n/)
    .filter(Boolean);

  const generatedPatterns = [
    /(^|\/)\.next\//,
    /(^|\/)dist\//,
    /(^|\/)dist-types\//,
    /(^|\/)node_modules\//,
    /(^|\/)tsconfig\.tsbuildinfo$/
  ];

  for (const file of trackedFiles) {
    if (generatedPatterns.some((pattern) => pattern.test(file))) {
      addFinding("blocking", "ARCH006", "Generated build output should not be tracked by git.", file);
    }

    if (file === ".env" || file.startsWith(".env.")) {
      addFinding("blocking", "SEC001", "Environment files must not be tracked by git.", file);
    }
  }
}

async function checkIdeaCardsLinked() {
  const ideaDir = path.join(root, "ideas");
  const entries = await readdir(ideaDir, { withFileTypes: true });
  const cards = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => entry.name);
  const readme = await readFile(path.join(ideaDir, "README.md"), "utf8");

  for (const card of cards) {
    if (!readme.includes(`./${card}`)) {
      addFinding("warning", "DOC001", "Idea card is not linked from ideas/README.md.", `ideas/${card}`);
    }
  }
}

async function checkPlanningDocs() {
  const roadmap = await readFile(path.join(root, "ideas", "project-roadmap.md"), "utf8");
  const scope = await readFile(path.join(root, "ideas", "version-one-scope-draft.md"), "utf8");

  if (!roadmap.includes("## Current Milestone")) {
    addFinding("warning", "DOC002", "Roadmap should identify the current milestone.", "ideas/project-roadmap.md");
  }

  if (!roadmap.includes("Before calling a phase done:")) {
    addFinding("warning", "DOC003", "Roadmap should include phase completion gates.", "ideas/project-roadmap.md");
  }

  if (scope.includes("draft for discussion")) {
    addFinding("warning", "DOC004", "V1 scope still reads as an unapproved draft.", "ideas/version-one-scope-draft.md");
  }
}

function renderFindings(title, severity) {
  const matching = findings.filter((finding) => finding.severity === severity);
  const lines = [`## ${title}`, ""];

  if (matching.length === 0) {
    lines.push("None.");
    lines.push("");
    return lines;
  }

  for (const finding of matching) {
    const location = finding.filePath ? ` (${finding.filePath})` : "";
    lines.push(`- \`${finding.ruleId}\`${location}: ${finding.message}`);
  }

  lines.push("");
  return lines;
}

async function writeReport() {
  const reportDir = path.join(root, "reports");
  await mkdir(reportDir, { recursive: true });

  const branch = runGit(["branch", "--show-current"]);
  const commit = runGit(["rev-parse", "--short", "HEAD"]);
  const timestamp = new Date().toISOString();
  const blockingCount = findings.filter((finding) => finding.severity === "blocking").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  const noteCount = findings.filter((finding) => finding.severity === "note").length;
  const status = blockingCount > 0 ? "BLOCKED" : warningCount > 0 ? "WARNINGS" : "CLEAN";

  const lines = [
    "# Rule Violation Report",
    "",
    `Generated: ${timestamp}`,
    `Branch: ${branch}`,
    `Commit: ${commit}`,
    `Status: ${status}`,
    "",
    `Blocking: ${blockingCount}`,
    `Warnings: ${warningCount}`,
    `Notes: ${noteCount}`,
    "",
    ...renderFindings("Blocking", "blocking"),
    ...renderFindings("Warnings", "warning"),
    ...renderFindings("Notes", "note"),
    "## Workflow",
    "",
    "- Blocking findings should be fixed before continuing feature work.",
    "- Warnings can be fixed immediately or intentionally deferred.",
    "- Notes are informational and should not block work.",
    ""
  ];

  await writeFile(path.join(reportDir, "rule-violations.md"), lines.join("\n"), "utf8");
}

const files = await walk(root);

for (const file of files) {
  const repoPath = toRepoPath(file);
  checkTopLevel(repoPath);
  checkJunkFolders(repoPath);
  checkTypeScriptName(repoPath);
  await checkForbiddenImports(file, repoPath);
}

checkTrackedGeneratedFiles();
await checkIdeaCardsLinked();
await checkPlanningDocs();
await writeReport();

const blocking = findings.filter((finding) => finding.severity === "blocking");

if (blocking.length > 0) {
  console.error("Architecture rule violations:");
  for (const finding of blocking) {
    const location = finding.filePath ? ` (${finding.filePath})` : "";
    console.error(`- ${finding.ruleId}${location}: ${finding.message}`);
  }

  if (!reportOnly) {
    process.exit(1);
  }
}

if (findings.length > 0) {
  console.log(`Architecture rules completed with ${findings.length} finding(s). See reports/rule-violations.md.`);
} else {
  console.log("Architecture rules passed. See reports/rule-violations.md.");
}
