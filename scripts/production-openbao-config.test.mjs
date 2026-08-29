import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const compose = readFileSync(new URL("../docker-compose.production.yml", import.meta.url), "utf8");
const gitignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");

test("production API loads the ordinary environment before the OpenBao render", () => {
  assert.match(
    compose,
    /api:[\s\S]*?env_file:\s*\n\s*- \.env\.production\s*\n\s*- \.env\.openbao\.production/,
  );
});

test("the rendered OpenBao environment is excluded from Git", () => {
  assert.match(gitignore, /^\.env\.\*$/m);

  assert.throws(
    () => execFileSync(
      "git",
      ["ls-files", "--error-unmatch", ".env.openbao.production"],
      { stdio: "pipe" },
    ),
  );
});

test("production Compose contains only the rendered filename, never material", () => {
  assert.equal(compose.includes("TWITCH_EVENTSUB_WEBHOOK_SECRET="), false);
  assert.equal(compose.includes("root_token"), false);
  assert.equal(compose.includes("secret_id"), false);
});
