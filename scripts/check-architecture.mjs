import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const problems = [];

const allowedRootDirs = new Set(["apps", "ideas", "packages", "scripts"]);
const bannedJunkDirs = new Set(["models", "services", "types", "utils"]);
const allowedSuffixes = [
  ".config.ts",
  ".events.ts",
  ".rules.ts",
  ".schema.ts",
  ".service.ts",
  ".test.ts",
  ".types.ts",
  ".d.ts",
  "index.ts",
  "main.ts",
  "vite-env.d.ts"
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if ([".git", ".next", "dist", "dist-types", "node_modules"].includes(entry.name)) {
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
    problems.push(`${repoPath}: unexpected top-level folder "${top}"`);
  }
}

function checkJunkFolders(repoPath) {
  const parts = repoPath.split("/");
  const bad = parts.find((part) => bannedJunkDirs.has(part));
  if (bad) {
    problems.push(`${repoPath}: avoid broad "${bad}" folders; organize by domain instead`);
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

  problems.push(`${repoPath}: TypeScript file should use a known suffix or be intentionally added to the checker`);
}

async function checkForbiddenImports(filePath, repoPath) {
  if (!repoPath.endsWith(".ts") && !repoPath.endsWith(".tsx")) {
    return;
  }

  const text = await readFile(filePath, "utf8");

  if (repoPath.startsWith("packages/domain/") && text.includes("@maiks-yt/ui")) {
    problems.push(`${repoPath}: domain package must not import UI`);
  }

  if (repoPath.startsWith("packages/events/") && text.includes("apps/")) {
    problems.push(`${repoPath}: events package must not depend on app code`);
  }
}

const files = await walk(root);

for (const file of files) {
  const repoPath = toRepoPath(file);
  checkTopLevel(repoPath);
  checkJunkFolders(repoPath);
  checkTypeScriptName(repoPath);
  await checkForbiddenImports(file, repoPath);
}

if (problems.length > 0) {
  console.error("Architecture rule violations:");
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

console.log("Architecture rules passed.");
