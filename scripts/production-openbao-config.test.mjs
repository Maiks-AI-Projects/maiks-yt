import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const compose = readFileSync(new URL("../docker-compose.production.yml", import.meta.url), "utf8");
const gitignore = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
const openBaoApiTemplate = readFileSync(
  new URL("./openbao/production-api.env.ctmpl", import.meta.url),
  "utf8",
);

const expectedOpenBaoApiMappings = new Map([
  ["TWITCH_EVENTSUB_WEBHOOK_SECRET", "secret/data/maiks-yt/production/api/twitch-eventsub"],
  ["GITHUB_CLIENT_SECRET", "secret/data/maiks-yt/production/api/oauth-github"],
  ["GOOGLE_CLIENT_SECRET", "secret/data/maiks-yt/production/api/oauth-google"],
  ["DISCORD_CLIENT_SECRET", "secret/data/maiks-yt/production/api/oauth-discord"],
  ["DISCORD_BOT_TOKEN", "secret/data/maiks-yt/production/api/discord-bot"],
  ["TWITCH_CLIENT_SECRET", "secret/data/maiks-yt/production/api/twitch-client"],
  ["DATABASE_URL", "secret/data/maiks-yt/production/api/database"],
  ["BETTER_AUTH_SECRET", "secret/data/maiks-yt/production/api/auth-signing"],
  ["AUTH_DATA_ENCRYPTION_KEY_V1", "secret/data/maiks-yt/production/api/auth-data-protection"],
  ["TWITCH_CHAT_BOT_ACCESS_TOKEN", "secret/data/maiks-yt/production/api/twitch-chat-bot"],
  ["TWITCH_CHAT_BOT_REFRESH_TOKEN", "secret/data/maiks-yt/production/api/twitch-chat-bot"],
  ["TWITCH_CHAT_BOT_TOKEN_EXPIRES_AT", "secret/data/maiks-yt/production/api/twitch-chat-bot"],
  ["STEAM_WEB_API_KEY", "secret/data/maiks-yt/production/api/steam"],
]);

const expectedOpenBaoApiPaths = new Set(expectedOpenBaoApiMappings.values());

function extractTemplateSecretBlocks(template) {
  const secretBlockPattern = /{{-?\s*with\s+secret\s+"([^"]+)"\s*-?}}([\s\S]*?){{-?\s*end\s*-?}}/g;

  return [...template.matchAll(secretBlockPattern)].map(([, path, body]) => ({ path, body }));
}

function extractTemplateMappings(template) {
  const mappings = new Map();

  for (const { path, body } of extractTemplateSecretBlocks(template)) {
    let renderedInBlock = 0;

    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "") {
        continue;
      }

      const assignment = trimmed.match(/^([A-Z0-9_]+)=\{\{\s*\.Data\.data\.([A-Z0-9_]+)\s*\}\}$/);
      assert.notEqual(assignment, null, `Unexpected OpenBao Agent template line: ${trimmed}`);

      const [, renderedKey, sourceKey] = assignment;
      assert.equal(sourceKey, renderedKey, `${renderedKey} must render from the same KV data key`);
      assert.equal(mappings.has(renderedKey), false, `${renderedKey} is rendered more than once`);
      mappings.set(renderedKey, path);
      renderedInBlock += 1;
    }

    assert.ok(renderedInBlock > 0, `${path} must render at least one environment key`);
  }

  return mappings;
}

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

test("the OpenBao Agent API template pins the expected KV v2 key mapping", () => {
  assert.deepEqual(extractTemplateMappings(openBaoApiTemplate), expectedOpenBaoApiMappings);
});

test("the OpenBao Agent API template uses only expected production API KV v2 paths", () => {
  const templatePaths = new Set(extractTemplateSecretBlocks(openBaoApiTemplate).map(({ path }) => path));

  assert.deepEqual(templatePaths, expectedOpenBaoApiPaths);
});

test("the OpenBao Agent API template renders only allowlisted keys", () => {
  const renderedKeys = [...extractTemplateMappings(openBaoApiTemplate).keys()].sort();
  const expectedKeys = [...expectedOpenBaoApiMappings.keys()].sort();

  assert.deepEqual(renderedKeys, expectedKeys);
});

test("the OpenBao Agent API template excludes bootstrap material and literal values", () => {
  const forbiddenPatterns = [
    /\broot[_-]?token\b/i,
    /\bunseal\b/i,
    /\bapprole\b/i,
    /\brole[_-]?id\b/i,
    /\bsecret[_-]?id\b/i,
    /\bclient[_-]?token\b/i,
    /\btoken[_-]?accessor\b/i,
    /\bwrap[_-]?token\b/i,
    /\bVAULT_TOKEN\b/,
    /\bOPENBAO_TOKEN\b/,
    /\bBAO_TOKEN\b/,
    /^MARIADB_ROOT_PASSWORD=/m,
    /^MYSQL_ROOT_PASSWORD=/m,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(openBaoApiTemplate, pattern);
  }

  for (const line of openBaoApiTemplate.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("{{")) {
      continue;
    }

    assert.match(trimmed, /^[A-Z0-9_]+=\{\{\s*\.Data\.data\.[A-Z0-9_]+\s*\}\}$/);
  }
});
