#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const defaultTokenFile = join(repoRoot, "reports", "usable-urls.md");
const defaultOutputRoot = join(repoRoot, "reports", "visual-qa", "current-dev-smoke");
const codexRuntimeNodeModules = process.env.HOME
  ? join(process.env.HOME, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules")
  : null;
const injectionPattern = /bsc-dataseed|bsc-testnet-rpc|publicnode|eval\(atob|binance/i;
const sensitiveQueryKeys = new Set(["accessToken", "devAuthToken", "token", "bearer"]);

const parseArgs = (argv) => {
  const options = new Map();

  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) {
      options.set(match[1], match[2]);
    } else if (arg.startsWith("--")) {
      options.set(arg.slice(2), "true");
    }
  }

  return options;
};

const sanitizeTimestamp = (date) =>
  date.toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");

const findChromiumBinary = async (override) => {
  if (override) {
    return override;
  }

  for (const candidate of ["chromium-browser", "chromium", "google-chrome", "google-chrome-stable"]) {
    try {
      await execFileAsync("sh", ["-lc", `command -v ${candidate}`], { timeout: 2_000 });
      return candidate;
    } catch {
      // Try the next common binary name.
    }
  }

  throw new Error("No Chromium/Chrome binary found. Set DEV_VISUAL_SMOKE_CHROMIUM=/path/to/chrome.");
};

const loadPlaywright = () => {
  const searchPaths = [
    repoRoot,
    ...((process.env.NODE_PATH ?? "").split(":").filter(Boolean)),
    ...(codexRuntimeNodeModules ? [codexRuntimeNodeModules] : [])
  ];

  try {
    const resolved = require.resolve("playwright", { paths: searchPaths });
    return require(resolved);
  } catch {
    return null;
  }
};

const parseUrlAfterHeading = (markdown, heading) => {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === `## ${heading}`);

  if (headingIndex === -1) {
    return null;
  }

  for (const line of lines.slice(headingIndex + 1)) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## ")) {
      return null;
    }

    if (/^https?:\/\//.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
};

const safeUrl = (rawUrl) => {
  const url = new URL(rawUrl);

  for (const key of [...url.searchParams.keys()]) {
    if (sensitiveQueryKeys.has(key)) {
      url.searchParams.set(key, "REDACTED");
    }
  }

  return url.toString();
};

const withPath = (rawUrl, path) => {
  const url = new URL(rawUrl);
  url.pathname = path;
  return url.toString();
};

const addQueryValue = (rawUrl, key, value) => {
  if (!value) {
    return rawUrl;
  }

  const url = new URL(rawUrl);
  url.searchParams.set(key, value);
  return url.toString();
};

const getQueryValue = (rawUrl, key) => {
  if (!rawUrl) {
    return null;
  }

  return new URL(rawUrl).searchParams.get(key);
};

const buildSurfaceList = ({ adminUrl, controlUrl, chatUrl, overlayUrl, webBaseUrl }) => {
  const devAuthToken = getQueryValue(adminUrl, "devAuthToken");
  const surfaces = [
    {
      name: "web-home",
      url: `${webBaseUrl}/`,
      expectedText: ["Maiks.yt"]
    },
    {
      name: "account",
      url: `${webBaseUrl}/account`,
      expectedText: ["Account"]
    },
    {
      name: "accountability",
      url: `${webBaseUrl}/accountability`,
      expectedText: ["Accountability"]
    },
    {
      name: "actions",
      url: `${webBaseUrl}/actions`,
      expectedText: ["Action Panel", "Persistent Actions"]
    },
    {
      name: "affiliates",
      url: `${webBaseUrl}/affiliates`,
      expectedText: ["Affiliate Links", "Disclosure"]
    },
    {
      name: "community-rules",
      url: `${webBaseUrl}/community-rules`,
      expectedText: ["Community Rules"]
    },
    {
      name: "context",
      url: `${webBaseUrl}/context`,
      expectedText: ["Personal Context"]
    },
    {
      name: "games",
      url: `${webBaseUrl}/games`,
      expectedText: ["Games"]
    },
    {
      name: "links",
      url: `${webBaseUrl}/links`,
      expectedText: ["Maiks.yt Links"]
    },
    {
      name: "notifications-tool",
      url: `${webBaseUrl}/tools/notifications`,
      expectedText: ["Notifications"],
      rejectNavbar: true
    },
    {
      name: "tools-actions",
      url: `${webBaseUrl}/tools/actions`,
      expectedText: ["Persistent Actions"],
      rejectNavbar: true
    },
    {
      name: "privacy-analytics",
      url: `${webBaseUrl}/privacy/analytics`,
      expectedText: ["Analytics", "Necessary Data"]
    },
    {
      name: "projects",
      url: `${webBaseUrl}/projects`,
      expectedText: ["Projects"]
    },
    {
      name: "schedule",
      url: `${webBaseUrl}/schedule`,
      expectedText: ["Stream Schedule"]
    },
    {
      name: "updates",
      url: `${webBaseUrl}/updates`,
      expectedText: ["Public Updates"]
    }
  ];

  if (adminUrl) {
    for (const [name, path, expectedText] of [
      ["admin-dashboard", "/admin", ["Admin", "Stream Windows", "Streamer Chat", "Moderation Window", "Control Panel", "Recurring Smoke", "Provider Intake", "Pending Approvals", "Active Helpers", "Active Moderation", "Money Ledger"]],
      ["admin-backup-health", "/admin/backup/health", ["Backup Health", "Required Tables", "Dump Tool", "Warnings"]],
      ["admin-connections", "/admin/connections", ["Connections", "Provider Action Readiness", "provider.warn-in-origin-chat"]],
      ["admin-event-routing", "/admin/event-routing", "Event"],
      ["admin-games", "/admin/games", "Game"],
      ["admin-links", "/admin/links", "Link"],
      ["admin-live-helper", "/admin/live-helper", "Live"],
      ["admin-money", "/admin/money", ["Money", "Import Preview", "Preview CSV", "Create draft entries"]],
      ["admin-moderators", "/admin/moderators", "Moderator"],
      ["admin-pages", "/admin/pages", "Page Creator"],
      ["admin-projects", "/admin/projects", "Project"],
      ["admin-provider-integrations", "/admin/provider-integrations", "Provider"],
      ["admin-schedule", "/admin/schedule", "Schedule"],
      ["admin-sessions", "/admin/sessions", "Session"],
      ["admin-testing", "/admin/testing", ["Testing Guide", "Quick Open", "Stream Windows", "Installed Window Checklist", "Manual Testing Checklist", "Session started", "Start new session", "Copy progress", "Reset marks", "Mark section done", "Clear section", "Session Notes", "Testing note", "Copy template", "Severity: blocking / annoying / polish"]],
      ["admin-tokens", "/admin/tokens", "Token"]
    ]) {
      surfaces.push({
        name,
        url: withPath(adminUrl, path),
        expectedText: Array.isArray(expectedText) ? expectedText : [expectedText]
      });
    }
  }

  if (controlUrl) {
    for (const [name, path, expectedText] of [
      ["control-access-required", "/control", "Control Panel"],
      ["chat-access-required", "/chat", "Streamer Chat"],
      ["moderation-access-required", "/moderation", "Moderation"]
    ]) {
      surfaces.push({
        name,
        url: withPath(controlUrl, path),
        expectedText: [expectedText, "Access Required", "Control Panel access URL", "Access Tokens", "Testing Guide"],
        rejectNavbar: true
      });
    }
  }

  if (chatUrl) {
    surfaces.push({
      allowAuthRequired: true,
      name: "streamer-chat",
      url: addQueryValue(chatUrl, "devAuthToken", devAuthToken),
      expectedText: ["Chat", "Twitch"],
      rejectNavbar: true
    });
  }

  if (controlUrl) {
    surfaces.push({
      allowAuthRequired: true,
      name: "control-panel",
      url: addQueryValue(withPath(controlUrl, "/control"), "devAuthToken", devAuthToken),
      expectedText: ["Control Panel"],
      rejectNavbar: true
    });
    surfaces.push({
      allowAuthRequired: true,
      name: "moderation-window",
      url: addQueryValue(withPath(controlUrl, "/moderation"), "devAuthToken", devAuthToken),
      expectedText: ["Moderation", "Chat"],
      rejectNavbar: true
    });
  }

  if (overlayUrl) {
    surfaces.push({
      name: "overlay",
      url: overlayUrl,
      expectedText: []
    });
  }

  return surfaces;
};

const parseViewports = (rawViewports) =>
  rawViewports.split(",").map((rawViewport) => {
    const match = /^(\d+)x(\d+)$/.exec(rawViewport.trim());

    if (!match) {
      throw new Error(`Invalid viewport "${rawViewport}". Use WIDTHxHEIGHT, for example 1366x768.`);
    }

    return {
      width: Number(match[1]),
      height: Number(match[2]),
      label: `${match[1]}x${match[2]}`
    };
  });

const runChromium = async (chromium, args) => {
  const result = await execFileAsync(chromium, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    ...args
  ], {
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30_000
  });

  return result.stdout;
};

const captureSurface = async ({ chromium, outputDir, surface, viewport }) => {
  const screenshotFile = `${surface.name}-${viewport.label}.png`;
  const screenshotPath = join(outputDir, screenshotFile);
  const chromiumViewport = `${viewport.width},${viewport.height}`;

  await runChromium(chromium, [
    `--window-size=${chromiumViewport}`,
    "--virtual-time-budget=5000",
    `--screenshot=${screenshotPath}`,
    surface.url
  ]);

  const dom = await runChromium(chromium, [
    `--window-size=${chromiumViewport}`,
    "--virtual-time-budget=5000",
    "--dump-dom",
    surface.url
  ]);
  const missingExpectedText = surface.expectedText.filter((text) => !dom.includes(text));
  const hasInjectionMarker = injectionPattern.test(dom);
  const authRequired = surface.allowAuthRequired === true && dom.includes("Access Required");
  const hasRejectedNavbar = surface.rejectNavbar === true && dom.includes("site-header");

  return {
    authRequired,
    expectedText: surface.expectedText,
    hasInjectionMarker,
    hasHorizontalOverflow: false,
    hasRejectedNavbar,
    missingExpectedText,
    ok: (missingExpectedText.length === 0 || authRequired) && !hasInjectionMarker && !hasRejectedNavbar,
    screenshotFile,
    surface: surface.name,
    url: safeUrl(surface.url),
    viewport: viewport.label
  };
};

const captureSurfaceWithPlaywright = async ({ outputDir, page, surface, viewport }) => {
  const screenshotFile = `${surface.name}-${viewport.label}.png`;
  const screenshotPath = join(outputDir, screenshotFile);

  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(surface.url, { timeout: 30_000, waitUntil: "networkidle" });
  await page.waitForTimeout(1_000);
  await page.screenshot({ fullPage: true, path: screenshotPath });

  const dom = await page.content();
  const missingExpectedText = surface.expectedText.filter((text) => !dom.includes(text));
  const hasInjectionMarker = injectionPattern.test(dom);
  const authRequired = surface.allowAuthRequired === true && dom.includes("Access Required");
  const hasRejectedNavbar = surface.rejectNavbar === true && dom.includes("site-header");
  const layout = await page.evaluate(() => {
    const documentElement = document.documentElement;
    const body = document.body;
    const viewportWidth = documentElement.clientWidth;
    const scrollWidth = Math.max(
      documentElement.scrollWidth,
      body?.scrollWidth ?? 0
    );

    return {
      scrollWidth,
      viewportWidth
    };
  });
  const hasHorizontalOverflow = layout.scrollWidth > layout.viewportWidth + 1;

  return {
    authRequired,
    expectedText: surface.expectedText,
    hasInjectionMarker,
    hasHorizontalOverflow,
    hasRejectedNavbar,
    missingExpectedText,
    ok: (missingExpectedText.length === 0 || authRequired) && !hasInjectionMarker && !hasHorizontalOverflow && !hasRejectedNavbar,
    screenshotFile,
    scrollWidth: layout.scrollWidth,
    surface: surface.name,
    url: safeUrl(surface.url),
    viewportWidth: layout.viewportWidth,
    viewport: viewport.label
  };
};

const writeMarkdownReport = async ({ outputDir, results, startedAt, tokenFile, viewports }) => {
  const failures = results.filter((result) => !result.ok);
  const lines = [
    "# Current Dev Visual Smoke",
    "",
    `Generated: ${startedAt}`,
    "",
    "This local report is generated by `pnpm dev:visual-smoke`. It uses Chromium screenshots and DOM checks against the current dev URLs.",
    "",
    `Token source: \`${tokenFile}\``,
    `Viewports: ${viewports.map((viewport) => viewport.label).join(", ")}`,
    `Result: ${failures.length === 0 ? "passed" : `${failures.length} failed`}`,
    "",
    "Private URL query values are redacted from this report and `summary.json`.",
    "",
    "## Captures",
    ""
  ];

  for (const result of results) {
    const status = result.authRequired ? "auth-required" : result.ok ? "pass" : "fail";
    const notes = [];

    if (result.missingExpectedText.length > 0) {
      notes.push(`missing text: ${result.missingExpectedText.join(", ")}`);
    }

    if (result.hasInjectionMarker) {
      notes.push("known injection marker detected");
    }

    if (result.hasHorizontalOverflow) {
      notes.push(`horizontal overflow: ${result.scrollWidth}px > ${result.viewportWidth}px`);
    }

    if (result.hasRejectedNavbar) {
      notes.push("normal website navbar detected");
    }

    if (result.authRequired) {
      notes.push("fresh browser has URL token but no signed-in session");
    }

    lines.push(`- ${status}: ${result.surface} ${result.viewport} -> ${result.screenshotFile}${notes.length > 0 ? ` (${notes.join("; ")})` : ""}`);
  }

  await writeFile(join(outputDir, "README.md"), `${lines.join("\n")}\n`);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = new Date();
  const tokenFile = resolve(options.get("token-file") ?? process.env.DEV_VISUAL_SMOKE_TOKEN_FILE ?? defaultTokenFile);
  const outputDir = resolve(options.get("output") ?? process.env.DEV_VISUAL_SMOKE_OUTPUT_DIR ?? join(defaultOutputRoot, sanitizeTimestamp(startedAt)));
  const webBaseUrl = (options.get("web-url") ?? process.env.DEV_VISUAL_SMOKE_WEB_URL ?? "https://web-dev.maiks.yt").replace(/\/$/, "");
  const viewports = parseViewports(options.get("viewports") ?? process.env.DEV_VISUAL_SMOKE_VIEWPORTS ?? "1366x768,1600x900");
  const playwright = loadPlaywright();
  const chromium = playwright ? null : await findChromiumBinary(options.get("chromium") ?? process.env.DEV_VISUAL_SMOKE_CHROMIUM);

  let tokenMarkdown = "";

  try {
    tokenMarkdown = await readFile(tokenFile, "utf8");
  } catch {
    tokenMarkdown = "";
  }

  const adminUrl = options.get("admin-url") ?? process.env.DEV_VISUAL_SMOKE_ADMIN_URL ?? parseUrlAfterHeading(tokenMarkdown, "Admin Auth");
  const controlUrl = options.get("control-url") ?? process.env.DEV_VISUAL_SMOKE_CONTROL_URL ?? parseUrlAfterHeading(tokenMarkdown, "Control Panel");
  const chatUrl = options.get("chat-url") ?? process.env.DEV_VISUAL_SMOKE_CHAT_URL ?? parseUrlAfterHeading(tokenMarkdown, "Streamer Chat");
  const overlayUrl = options.get("overlay-url") ?? process.env.DEV_VISUAL_SMOKE_OVERLAY_URL ?? parseUrlAfterHeading(tokenMarkdown, "OBS Overlay");
  const surfaces = buildSurfaceList({ adminUrl, controlUrl, chatUrl, overlayUrl, webBaseUrl });

  await mkdir(outputDir, { recursive: true });

  const results = [];

  if (playwright) {
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    try {
      for (const surface of surfaces) {
        for (const viewport of viewports) {
          process.stdout.write(`Capturing ${surface.name} ${viewport.label} with Playwright...\n`);
          results.push(await captureSurfaceWithPlaywright({ outputDir, page, surface, viewport }));
        }
      }
    } finally {
      await browser.close();
    }
  } else {
    for (const surface of surfaces) {
      for (const viewport of viewports) {
        process.stdout.write(`Capturing ${surface.name} ${viewport.label} with Chromium CLI...\n`);
        results.push(await captureSurface({ chromium, outputDir, surface, viewport }));
      }
    }
  }

  const summary = {
    browser: playwright ? "playwright" : basename(chromium),
    generatedAt: startedAt.toISOString(),
    ok: results.every((result) => result.ok),
    outputDir,
    results,
    tokenFile,
    viewports: viewports.map((viewport) => viewport.label)
  };

  await writeFile(join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  await writeMarkdownReport({ outputDir, results, startedAt: startedAt.toISOString(), tokenFile, viewports });

  process.stdout.write(`Visual smoke report written to ${outputDir}\n`);

  if (!summary.ok) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
