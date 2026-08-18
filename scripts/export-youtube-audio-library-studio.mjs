#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { studioAudioLibrarySelectors as selectors } from "./youtube-audio-library-studio-selectors.mjs";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultProfileDir = path.join(repoRoot, ".private", "youtube-audio-library-studio-profile");
const defaultOutputDir = path.join(repoRoot, ".private", "youtube-audio-library-export");
const manifestVersion = "youtube-audio-library.v1";
const ccBy4Url = "https://creativecommons.org/licenses/by/4.0/";
const rowExportMarkerAttribute = "data-maiks-ytal-export-id";

const usage = `
Usage:
  node scripts/export-youtube-audio-library-studio.mjs --studio-url <current-studio-audio-library-url> [--output-dir ./.private/youtube-audio-library-export]

Options:
  --studio-url     Current YouTube Studio Audio Library URL. Use the page with the Attribution required filter available.
  --output-dir     Writes manifest and downloaded audio here.
  --profile-dir    Persistent local browser profile. Default: .private/youtube-audio-library-studio-profile
  --max-tracks     Bounded export limit. Default: 5000.
  --headless       Run headless after the profile is already logged in.

Notes:
  This is a local owner-run Studio UI extractor, not a supported YouTube API.
  It may require one interactive Google login in the persistent profile.
  It only emits rows whose visible Studio metadata indicates Attribution required / Creative Commons Attribution 4.0.
`;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {
    studioUrl: process.env.YOUTUBE_STUDIO_AUDIO_LIBRARY_URL ?? null,
    outputDir: process.env.YOUTUBE_AUDIO_LIBRARY_EXPORT_DIR ?? defaultOutputDir,
    profileDir: process.env.YOUTUBE_STUDIO_PROFILE_DIR ?? defaultProfileDir,
    maxTracks: 5_000,
    headless: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--headless") {
      parsed.headless = true;
      continue;
    }

    const next = args[index + 1];
    if (!next) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === "--studio-url") {
      parsed.studioUrl = next;
    } else if (arg === "--output-dir") {
      parsed.outputDir = next;
    } else if (arg === "--profile-dir") {
      parsed.profileDir = next;
    } else if (arg === "--max-tracks") {
      parsed.maxTracks = Number(next);
    } else {
      throw new Error(`Unknown option ${arg}`);
    }

    index += 1;
  }

  if (!Number.isInteger(parsed.maxTracks) || parsed.maxTracks < 1 || parsed.maxTracks > 5_000) {
    throw new Error("--max-tracks must be between 1 and 5000.");
  }
  if (!parsed.studioUrl) {
    throw new Error("--studio-url is required.");
  }

  return parsed;
};

const loadPlaywright = () => {
  const searchPaths = [
    repoRoot,
    ...((process.env.NODE_PATH ?? "").split(":").filter(Boolean)),
    ...(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES] : [])
  ];

  try {
    const resolved = require.resolve("playwright", { paths: searchPaths });
    return require(resolved);
  } catch {
    throw new Error("Playwright is required for Studio export. Install/enable Playwright in the local workspace runtime.");
  }
};

const safeFilename = (value, fallback) => {
  const cleaned = value
    .trim()
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 100)
    .replace(/^_+|_+$/g, "");

  return cleaned || fallback;
};

const durationSecondsFromText = (value) => {
  const match = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/u.exec(value);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);

  return (hours * 3600) + (minutes * 60) + seconds;
};

const extractRowsFromDom = (input) => {
  const { selectorList, runId, markerAttribute } = input;
  const getTextForSelectors = (root, selectorListForText) => {
    for (const selector of selectorListForText) {
      const element = root.querySelector(selector);
      const value = element?.value || element?.textContent || element?.getAttribute("aria-label");
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return null;
  };
  const rowSelectors = selectorList.trackRows.join(",");
  const candidates = [...document.querySelectorAll(rowSelectors)]
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const text = element.textContent ?? "";
      return rect.width > 0 && rect.height > 0 && text.trim().length > 10;
    });

  return candidates.map((element, index) => {
    const text = element.textContent ?? "";
    const exportId = `${runId}-${index}`;
    element.setAttribute(markerAttribute, exportId);
    const title = getTextForSelectors(element, selectorList.title);
    const artist = getTextForSelectors(element, selectorList.artist);
    const licenseText = getTextForSelectors(element, selectorList.license) ?? text;
    const attributionText = getTextForSelectors(element, selectorList.attribution);
    const links = [...element.querySelectorAll("a[href]")].map((link) => link.href);
    const downloadUrl = links.find((href) => /download|audiolibrary/i.test(href)) ?? null;

    return {
      index,
      exportId,
      text,
      title,
      artist,
      licenseText,
      attributionText,
      downloadUrl
    };
  });
};

const extractVisibleRows = async (page, runId) =>
  await page.evaluate(extractRowsFromDom, {
    selectorList: selectors,
    runId,
    markerAttribute: rowExportMarkerAttribute
  });

export const rowLooksCcByAttributionRequired = (row) => {
  const text = `${row.licenseText} ${row.text}`.toLowerCase();
  return (text.includes("attribution required") || text.includes("creative commons") || text.includes("cc by"))
    && !text.includes("no attribution required");
};

export const inferTitleArtist = (row) => {
  const lines = row.text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(download|play|pause|favorite|star|duration|license)$/iu.test(line));

  return {
    title: row.title ?? lines[0] ?? null,
    artist: row.artist ?? lines[1] ?? "YouTube Audio Library Artist"
  };
};

const normalizedIncludes = (text, expected) =>
  typeof text === "string"
    && typeof expected === "string"
    && expected.trim().length > 0
    && text.toLowerCase().includes(expected.trim().toLowerCase());

export const evidenceMatchesRow = (row, evidence) => {
  const { title, artist } = inferTitleArtist(row);
  const evidenceText = [
    evidence?.dialogText,
    evidence?.attributionText,
    evidence?.licenseText,
    evidence?.sourceText
  ].filter(Boolean).join("\n");

  return Boolean(
    title
      && normalizedIncludes(evidenceText, title)
      && (!row.artist || normalizedIncludes(evidenceText, artist))
  );
};

export const rowTextMatchesMetadata = (rowText, row) => {
  const { title, artist } = inferTitleArtist(row);
  return Boolean(
    title
      && normalizedIncludes(rowText, title)
      && (!row.artist || normalizedIncludes(rowText, artist))
  );
};

export const extractStableExternalId = (urls, audioSha256) => {
  for (const rawUrl of urls) {
    if (!rawUrl || typeof rawUrl !== "string") {
      continue;
    }

    try {
      const url = new URL(rawUrl);
      for (const key of ["id", "vid", "v", "track", "trackId", "resourceId", "referenceId"]) {
        const value = url.searchParams.get(key);
        if (value?.trim()) {
          return value.trim().slice(0, 191);
        }
      }

      const pathId = url.pathname
        .split("/")
        .map((part) => part.trim())
        .filter(Boolean)
        .findLast((part) => /^[A-Za-z0-9_-]{8,}$/u.test(part));

      if (pathId) {
        return pathId.slice(0, 191);
      }
    } catch {
      // Ignore non-URL values.
    }
  }

  return `audio-sha256-${audioSha256}`;
};

export const resolveExportRefreshMode = (completeness) =>
  completeness.reachedEnd
    && completeness.tracksExported > 0
    && completeness.skippedCandidates === 0
    && !completeness.hitMaxTracks
    && completeness.filterApplied === true
    ? "full"
    : "partial";

const clickAttributionFilter = async (page) => {
  for (const buttonSelector of selectors.filterButtons) {
    const button = page.locator(buttonSelector).first();
    if (await button.count().catch(() => 0) === 0) {
      continue;
    }

    await button.click().catch(() => undefined);
    for (const optionSelector of selectors.attributionFilterOptions) {
      const option = page.locator(optionSelector).first();
      if (await option.count().catch(() => 0) === 0) {
        continue;
      }

      await option.click().catch(() => undefined);
      await page.waitForTimeout(1_000);
      return true;
    }
  }

  return false;
};

const rowStillMatchesMetadata = async (rowLocator, row) => {
  const rowText = await rowLocator.evaluate((element) => element.textContent ?? "").catch(() => null);
  return rowTextMatchesMetadata(rowText, row);
};

const downloadRowAudio = async (page, rowLocator, row, outputAudioDir, fallbackName) => {
  if (!await rowStillMatchesMetadata(rowLocator, row)) {
    return null;
  }

  const downloadButton = rowLocator.locator(selectors.downloadButtons.join(",")).first();

  if (await downloadButton.count().catch(() => 0) === 0) {
    return null;
  }

  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 }).catch(() => null);
  await downloadButton.click().catch(() => undefined);
  const download = await downloadPromise;

  if (!download) {
    return null;
  }

  const suggested = safeFilename(download.suggestedFilename(), `${fallbackName}.mp3`);
  const filePath = path.join(outputAudioDir, suggested);
  await download.saveAs(filePath);

  const bytes = await readFile(filePath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  return {
    fileName: suggested,
    filePath,
    sha256,
    url: typeof download.url === "function" ? download.url() : null
  };
};

const closeOpenDialog = async (page) => {
  const closeButton = page.locator(selectors.closeButtons.join(",")).last();
  if (await closeButton.count().catch(() => 0) > 0) {
    await closeButton.click().catch(() => undefined);
  } else {
    await page.keyboard.press("Escape").catch(() => undefined);
  }
  await page.waitForTimeout(300);
};

const readRowLicenseDialogEvidence = async (page, rowLocator) => {
  const detailButton = rowLocator.locator(selectors.detailButtons.join(",")).first();
  if (await detailButton.count().catch(() => 0) > 0) {
    await detailButton.click().catch(() => undefined);
  } else {
    await rowLocator.click().catch(() => undefined);
  }

  await page.waitForTimeout(750);

  const evidence = await page.evaluate((selectorList) => {
    const dialogs = selectorList.dialogs.flatMap((selector) => [...document.querySelectorAll(selector)]);
    const dialog = dialogs.findLast((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (element.textContent ?? "").trim().length > 0;
    });

    if (!dialog) {
      return null;
    }

    const dialogText = dialog.textContent ?? "";
    const attributionValues = [];
    for (const selector of selectorList.attribution) {
      const elements = [...dialog.querySelectorAll(selector)];
      for (const element of elements) {
        const value = element.value || element.textContent || element.getAttribute("aria-label");
        if (typeof value === "string" && value.trim().length > 10) {
          attributionValues.push(value.trim());
        }
      }
    }

    const linkElements = selectorList.proofLinks
      .flatMap((selector) => [...dialog.querySelectorAll(selector)]);
    const links = linkElements
      .map((link) => link.href)
      .filter((href) => typeof href === "string" && href.startsWith("http"));
    const licenseUrl = links.find((href) => href.toLowerCase().startsWith("https://creativecommons.org/licenses/by/4.0")) ?? null;
    const proofLink = linkElements.find((link) => typeof link.href === "string"
      && link.href.startsWith("http")
      && !link.href.toLowerCase().startsWith("https://creativecommons.org/licenses/by/4.0")) ?? null;
    const proofUrl = proofLink?.href ?? null;
    const sourceText = proofLink?.closest("p, div, section, ytcp-form-input-container")?.textContent?.trim()
      || proofLink?.textContent?.trim()
      || proofUrl;

    return {
      attributionText: attributionValues[0] ?? null,
      dialogText,
      licenseText: dialogText,
      licenseUrl,
      proofUrl,
      sourceUrl: proofUrl,
      sourceText,
      linkUrls: links
    };
  }, selectors);

  await closeOpenDialog(page);

  return evidence;
};

const buildManifestTrack = ({ row, evidence, download, studioUrl }) => {
  const { title, artist } = inferTitleArtist(row);
  if (!title
    || !download
    || !studioUrl
    || !evidence?.attributionText
    || !evidence.licenseText
    || !evidence.sourceText
    || !evidence.proofUrl
    || !evidence.licenseUrl) {
    return null;
  }

  const externalId = extractStableExternalId(
    [evidence.sourceUrl, evidence.proofUrl, row.downloadUrl, download.url],
    download.sha256
  );

  return {
    externalId,
    title,
    artist,
    durationSeconds: durationSecondsFromText(row.text),
    licenseName: "Creative Commons Attribution 4.0",
    licenseUrl: evidence.licenseUrl ?? ccBy4Url,
    attributionRequired: true,
    attributionText: evidence.attributionText,
    audio: {
      sha256: download.sha256,
      mimeType: "audio/mpeg"
    },
    proof: {
      url: evidence.proofUrl
    },
    studioEvidence: {
      studioUrl,
      dialogText: evidence.dialogText,
      attributionText: evidence.attributionText,
      licenseText: evidence.licenseText,
      sourceText: evidence.sourceText,
      sourceUrl: evidence.sourceUrl,
      proofUrl: evidence.proofUrl
    },
    tags: ["youtube-audio-library", "cc-by-4.0", "studio-ui-export"],
    fileName: download.fileName
  };
};

const scrollForward = async (page) =>
  await page.evaluate((scrollSelectors) => {
    for (const selector of scrollSelectors) {
      const element = document.querySelector(selector);
      if (element && element.scrollHeight > element.clientHeight) {
        const before = element.scrollTop;
        element.scrollBy(0, Math.max(400, element.clientHeight * 0.85));
        const after = element.scrollTop;

        return {
          moved: after > before,
          atEnd: after + element.clientHeight >= element.scrollHeight - 8
        };
      }
    }

    const before = window.scrollY;
    window.scrollBy(0, Math.max(400, window.innerHeight * 0.85));
    const after = window.scrollY;

    return {
      moved: after > before,
      atEnd: after + window.innerHeight >= document.body.scrollHeight - 8
    };
  }, selectors.scrollContainers);

const addSkipReason = (completeness, reason) => {
  completeness.skippedCandidates += 1;
  completeness.skipReasons[reason] = (completeness.skipReasons[reason] ?? 0) + 1;
};

const processVisibleCatalog = async (page, audioDir, maxTracks, studioUrl) => {
  const tracks = [];
  const seenRows = new Set();
  const completeness = {
    reachedEnd: false,
    hitMaxTracks: false,
    visibleRows: 0,
    candidateRows: 0,
    processedCandidates: 0,
    skippedCandidates: 0,
    skipReasons: {},
    tracksExported: 0,
    filterApplied: true
  };
  let stableEndRounds = 0;

  while (tracks.length < maxTracks) {
    const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const visibleRows = await extractVisibleRows(page, runId);
    let newCandidateCount = 0;
    completeness.visibleRows += visibleRows.length;

    for (const row of visibleRows) {
      if (!rowLooksCcByAttributionRequired(row)) {
        continue;
      }

      const rowKey = createHash("sha256").update(`${row.downloadUrl ?? ""}\n${row.text}`).digest("hex");
      if (seenRows.has(rowKey)) {
        continue;
      }
      seenRows.add(rowKey);
      newCandidateCount += 1;
      completeness.candidateRows += 1;

      if (tracks.length >= maxTracks) {
        completeness.hitMaxTracks = true;
        break;
      }

      const rowLocator = page.locator(`[${rowExportMarkerAttribute}="${row.exportId}"]`).first();
      if (await rowLocator.count().catch(() => 0) === 0) {
        addSkipReason(completeness, "row_not_visible");
        continue;
      }
      if (!await rowStillMatchesMetadata(rowLocator, row)) {
        addSkipReason(completeness, "row_metadata_mismatch");
        continue;
      }

      const evidence = await readRowLicenseDialogEvidence(page, rowLocator);
      if (!evidence?.proofUrl || !evidence.attributionText || !evidence.licenseUrl) {
        addSkipReason(completeness, "license_dialog_evidence_missing");
        continue;
      }
      if (!evidenceMatchesRow(row, evidence)) {
        addSkipReason(completeness, "license_dialog_track_mismatch");
        continue;
      }
      if (!rowLooksCcByAttributionRequired({
        ...row,
        licenseText: evidence.licenseText,
        text: `${row.text}\n${evidence.licenseText}`
      })) {
        addSkipReason(completeness, "license_dialog_not_cc_by_attribution_required");
        continue;
      }

      const { title } = inferTitleArtist(row);
      const fallbackName = safeFilename(title ?? `track-${completeness.candidateRows}`, `track-${completeness.candidateRows}`);
      const download = await downloadRowAudio(page, rowLocator, row, audioDir, fallbackName);
      if (!download) {
        addSkipReason(completeness, "download_failed");
        continue;
      }

      const track = buildManifestTrack({
        row,
        evidence,
        download,
        studioUrl
      });

      if (!track) {
        addSkipReason(completeness, "manifest_track_incomplete");
        continue;
      }

      tracks.push(track);
      completeness.processedCandidates += 1;
      completeness.tracksExported = tracks.length;
      console.log(`Exported ${tracks.length}: ${track.title}`);
    }

    if (tracks.length >= maxTracks) {
      completeness.hitMaxTracks = true;
      break;
    }

    const scrollResult = await scrollForward(page);
    await page.waitForTimeout(1_000);

    if (scrollResult.atEnd && newCandidateCount === 0) {
      stableEndRounds += 1;
    } else {
      stableEndRounds = 0;
    }

    if ((!scrollResult.moved || scrollResult.atEnd) && stableEndRounds >= 2) {
      completeness.reachedEnd = true;
      break;
    }
  }

  completeness.tracksExported = tracks.length;

  return {
    tracks,
    completeness: {
      ...completeness,
      refreshMode: resolveExportRefreshMode(completeness)
    }
  };
};

const main = async () => {
  const options = parseArgs();
  const playwright = loadPlaywright();
  const outputDir = path.resolve(options.outputDir);
  const audioDir = path.join(outputDir, "audio");

  await mkdir(audioDir, { recursive: true, mode: 0o700 });

  const context = await playwright.chromium.launchPersistentContext(path.resolve(options.profileDir), {
    acceptDownloads: true,
    headless: options.headless,
    viewport: { width: 1440, height: 1000 }
  });
  const page = context.pages()[0] ?? await context.newPage();

  try {
    await page.goto(options.studioUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    if (page.url().includes("accounts.google.com")) {
      console.log("Complete Google login in the opened browser window. The profile is reused on later runs.");
      await page.waitForURL((url) => !url.href.includes("accounts.google.com"), { timeout: 10 * 60_000 });
    }

    await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => undefined);
    const filterClicked = await clickAttributionFilter(page);
    if (!filterClicked) {
      throw new Error("Could not apply the YouTube Studio Attribution required filter. Export failed closed.");
    }

    const { tracks, completeness } = await processVisibleCatalog(page, audioDir, options.maxTracks, page.url());

    const manifest = {
      manifestVersion,
      exportedAt: new Date().toISOString(),
      refreshMode: completeness.refreshMode,
      source: "youtube-studio",
      exportCompleteness: completeness,
      tracks
    };
    const manifestPath = path.join(outputDir, "youtube-audio-library-manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    console.log(JSON.stringify({
      manifestPath,
      audioDir,
      trackCount: tracks.length,
      exportCompleteness: completeness
    }, null, 2));
  } finally {
    await context.close();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage.trim());
    process.exit(1);
  });
}
