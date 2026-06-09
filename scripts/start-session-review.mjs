import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

execFileSync("node", ["scripts/check-architecture.mjs", "--report-only"], {
  cwd: root,
  stdio: "inherit"
});

const reportPath = path.join(root, "reports", "rule-violations.md");
const report = await readFile(reportPath, "utf8");

console.log("");
console.log(report);
