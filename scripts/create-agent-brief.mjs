import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const currentWorkPath = path.join(root, "reports", "current-work.md");
const outputPath = path.join(root, "reports", "agent-brief.md");

const runGit = (...args) => execFileSync("git", args, {
  cwd: root,
  encoding: "utf8"
}).trim();

const currentWork = await readFile(currentWorkPath, "utf8");
const branch = runGit("branch", "--show-current");
const commit = runGit("log", "-1", "--oneline");
const status = runGit("status", "--short");
const generatedAt = new Date().toISOString();

const brief = `# Agent Brief

Generated: ${generatedAt}
Branch: \`${branch}\`
Commit: \`${commit}\`

## Working Tree

\`\`\`text
${status || "clean"}
\`\`\`

${currentWork.replace(/^# Current Work\s*/u, "")}

## Required Instructions

Read \`AGENTS.md\` before editing. Workers do not commit, push, deploy, or modify secrets.
`;

await writeFile(outputPath, brief, "utf8");
console.log(`Wrote ${path.relative(root, outputPath)}.`);
