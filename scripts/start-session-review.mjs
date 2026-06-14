import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

execFileSync("node", ["scripts/create-agent-brief.mjs"], {
  cwd: root,
  stdio: "inherit"
});

execFileSync("node", ["scripts/check-architecture.mjs", "--report-only"], {
  cwd: root,
  stdio: "inherit"
});

const reportPath = path.join(root, "reports", "rule-violations.md");
const report = await readFile(reportPath, "utf8");
const agentBriefPath = path.join(root, "reports", "agent-brief.md");
const agentBrief = await readFile(agentBriefPath, "utf8");

console.log("");
console.log(agentBrief);
console.log("");
console.log(report);
