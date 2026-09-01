"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { captureDevAuthTokenFromUrl } from "../../../dev-auth-token";
import {
  applyIncompetechImport,
  applyYouTubeAudioLibraryImport,
  dryRunIncompetechImport,
  dryRunYouTubeAudioLibraryImport,
  uploadAdminMusicAudio
} from "../../../music/music-api.service";
import type {
  MusicIncompetechManifest,
  MusicYouTubeAudioLibraryImportResult,
  MusicYouTubeAudioLibraryManifest
} from "../../../music/music-api.types";
import styles from "../../../music/music.module.css";
import { MusicAdminHeader } from "../admin-music-shared";
import {
  analyzeIncompetechAudioSelection,
  buildPreparedIncompetechManifest,
  buildPreparedManifest,
  expectedIncompetechManifestSha256,
  findMissingAudioFiles,
  getManifestAudioFileNames,
  hasUnsavedImportSelection,
  indexAudioFilesByName,
  safeImportFileName,
  summarizeImportCounts,
  type ImportAudioUpload,
  type ManifestWithFileNames
} from "./admin-music-import-workflow.service";

type ImportPhase = "idle" | "uploading" | "dry-run" | "ready" | "applying" | "applied" | "error";
type IncompetechDryRunGuard = {
  readonly requestId: number;
  readonly selectionFingerprint: number;
};

const isManifestWithTracks = (value: unknown): value is ManifestWithFileNames =>
  Boolean(value)
    && typeof value === "object"
    && (value as { manifestVersion?: unknown }).manifestVersion === "youtube-audio-library.v1"
    && (value as { source?: unknown }).source === "youtube-studio"
    && Array.isArray((value as { tracks?: unknown }).tracks);

const isIncompetechManifest = (value: unknown): value is MusicIncompetechManifest =>
  Boolean(value)
    && typeof value === "object"
    && (value as { manifestVersion?: unknown }).manifestVersion === "incompetech-ccby4.v1"
    && (value as { source?: unknown }).source === "incompetech"
    && Array.isArray((value as { tracks?: unknown }).tracks);

const contentTypeForFile = (file: File): string => {
  if (file.type.trim()) {
    return file.type.trim();
  }

  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "m4a") {
    return "audio/mp4";
  }
  if (extension === "wav") {
    return "audio/wav";
  }
  if (extension === "ogg") {
    return "audio/ogg";
  }
  if (extension === "flac") {
    return "audio/flac";
  }

  return "audio/mpeg";
};

const readFileAsText = async (file: File): Promise<string> => await file.text();

const readFileAsBase64 = async (file: File): Promise<string> =>
  await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("error", () => reject(new Error("file_read_failed")));
    reader.addEventListener("load", () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = result.indexOf(",");

      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    });
    reader.readAsDataURL(file);
  });

const sha256Hex = async (file: File): Promise<string> => {
  const digest = await window.crypto.subtle.digest("SHA-256", await file.arrayBuffer());

  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const sha256Text = async (value: string): Promise<string> => {
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

  return [...new Uint8Array(digest)]
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
};

const createInitialMessage = "Select a Studio exporter manifest and its downloaded audio files.";
const createInitialIncompetechMessage = "Select the reviewed Incompetech manifest and its 20 local MP3 files.";
const sha256Mp3FilePattern = /^([a-f0-9]{64})\.mp3$/u;

const resultReason = (result: MusicYouTubeAudioLibraryImportResult): string =>
  result.ok ? "ok" : result.reason;

const getIncompetechFileSha = (file: File): string | null => {
  const nameMatch = sha256Mp3FilePattern.exec(safeImportFileName(file.name).toLowerCase());
  if (nameMatch) {
    return nameMatch[1] ?? null;
  }

  const relativePath = file.webkitRelativePath?.replaceAll("\\", "/").toLowerCase() ?? "";
  const relativeName = relativePath.split("/").pop() ?? "";
  const relativeMatch = sha256Mp3FilePattern.exec(relativeName);

  return relativeMatch?.[1] ?? null;
};

const indexIncompetechFilesBySha = (files: readonly File[]): Map<string, File> => {
  const indexed = new Map<string, File>();

  for (const file of files) {
    const sha256 = getIncompetechFileSha(file);
    if (sha256 && !indexed.has(sha256)) {
      indexed.set(sha256, file);
    }
  }

  return indexed;
};

const YouTubeAudioLibraryImportWorkflow = (): React.ReactNode => {
  const [audioFiles, setAudioFiles] = useState<readonly File[]>([]);
  const [applyResult, setApplyResult] = useState<MusicYouTubeAudioLibraryImportResult | null>(null);
  const [dryRunResult, setDryRunResult] = useState<MusicYouTubeAudioLibraryImportResult | null>(null);
  const [manifest, setManifest] = useState<ManifestWithFileNames | null>(null);
  const [manifestFileName, setManifestFileName] = useState<string | null>(null);
  const [message, setMessage] = useState(createInitialMessage);
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [preparedManifest, setPreparedManifest] = useState<MusicYouTubeAudioLibraryManifest | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const manifestAudioNames = useMemo(() => manifest ? getManifestAudioFileNames(manifest) : [], [manifest]);
  const missingAudioNames = useMemo(
    () => manifest ? findMissingAudioFiles(manifest, audioFiles) : [],
    [audioFiles, manifest]
  );
  const dirty = hasUnsavedImportSelection({
    applied: phase === "applied",
    audioFileCount: audioFiles.length,
    manifestSelected: Boolean(manifest),
    prepared: Boolean(preparedManifest)
  });

  useEffect(() => {
    captureDevAuthTokenFromUrl();
  }, []);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const beforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    const clickGuard = (event: MouseEvent): void => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;

      if (target && !window.confirm("Leave this import workflow and discard selected local files?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", clickGuard, { capture: true });

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", clickGuard, { capture: true });
    };
  }, [dirty]);

  const resetServerState = (): void => {
    setApplyResult(null);
    setDryRunResult(null);
    setPreparedManifest(null);
    setUploadProgress(null);
  };

  const onManifestSelected = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0] ?? null;
    resetServerState();
    setPhase("idle");
    setManifest(null);
    setManifestFileName(null);

    if (!file) {
      setMessage(createInitialMessage);
      return;
    }

    try {
      const parsed = JSON.parse(await readFileAsText(file)) as unknown;

      if (!isManifestWithTracks(parsed)) {
        setPhase("error");
        setMessage("Manifest must be a typed YouTube Studio Audio Library export.");
        return;
      }

      setManifest(parsed);
      setManifestFileName(safeImportFileName(file.name));
      setMessage(`${parsed.tracks.length} manifest rows selected. Audio files are still local.`);
    } catch {
      setPhase("error");
      setMessage("Could not parse manifest JSON.");
    }
  };

  const onAudioSelected = (event: ChangeEvent<HTMLInputElement>): void => {
    resetServerState();
    setPhase("idle");
    setAudioFiles([...event.currentTarget.files ?? []]);
    setMessage("Audio files selected locally. Nothing has been uploaded yet.");
  };

  const uploadReferencedAudio = async (): Promise<Map<string, ImportAudioUpload> | null> => {
    if (!manifest) {
      setMessage("Select a manifest first.");
      return null;
    }

    const missing = findMissingAudioFiles(manifest, audioFiles);
    if (missing.length > 0) {
      setPhase("error");
      setMessage(`Missing audio files: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}`);
      return null;
    }

    const fileByName = indexAudioFilesByName(audioFiles);
    const uploads = new Map<string, ImportAudioUpload>();

    for (const fileName of manifestAudioNames) {
      const file = fileByName.get(fileName.toLowerCase());

      if (!file) {
        setPhase("error");
        setMessage(`Missing audio file: ${fileName}`);
        return null;
      }

      const safeFileName = safeImportFileName(file.name);
      setUploadProgress(`Uploading ${safeFileName}`);
      const [dataBase64, localSha256] = await Promise.all([
        readFileAsBase64(file),
        sha256Hex(file)
      ]);
      const response = await uploadAdminMusicAudio({
        filename: safeFileName,
        contentType: contentTypeForFile(file),
        dataBase64
      });

      if (!response.payload.ok) {
        setPhase("error");
        setMessage(`Upload blocked for ${safeFileName}: ${response.payload.reason}`);
        return null;
      }

      if (response.payload.upload.sha256.toLowerCase() !== localSha256) {
        setPhase("error");
        setMessage(`Checksum mismatch after upload for ${safeFileName}.`);
        return null;
      }

      uploads.set(fileName.toLowerCase(), response.payload.upload);
    }

    return uploads;
  };

  const runDryRun = async (): Promise<void> => {
    if (!manifest) {
      setMessage("Select a manifest first.");
      return;
    }

    setPhase("uploading");
    resetServerState();

    try {
      const uploads = await uploadReferencedAudio();

      if (!uploads) {
        return;
      }

      const prepared = buildPreparedManifest(manifest, uploads);
      if (!prepared.ok) {
        setPhase("error");
        setMessage(prepared.errors.slice(0, 5).join(" "));
        return;
      }

      setPreparedManifest(prepared.manifest);
      setPhase("dry-run");
      setUploadProgress(`Uploaded ${prepared.uploadedTrackCount} referenced audio files.`);
      const response = await dryRunYouTubeAudioLibraryImport(prepared.manifest);

      setDryRunResult(response.payload);
      if (!response.payload.ok) {
        setPhase("error");
        setMessage(`Dry-run blocked: ${response.payload.reason}`);
        return;
      }

      setPhase("ready");
      setMessage(`Dry-run ready: ${summarizeImportCounts(response.payload.summary)}.`);
    } catch {
      setPhase("error");
      setMessage("Import dry-run failed before apply.");
    }
  };

  const applyImport = async (): Promise<void> => {
    if (!preparedManifest || !dryRunResult?.ok) {
      setMessage("Run a successful dry-run before apply.");
      return;
    }

    setPhase("applying");
    setMessage("Applying YouTube Audio Library import...");

    try {
      const response = await applyYouTubeAudioLibraryImport(preparedManifest);

      setApplyResult(response.payload);
      if (!response.payload.ok) {
        setPhase("error");
        setMessage(`Apply blocked: ${response.payload.reason}`);
        return;
      }

      setPhase("applied");
      setMessage(`Import applied: ${summarizeImportCounts(response.payload.summary)}.`);
    } catch {
      setPhase("error");
      setMessage("Import apply failed.");
    }
  };

  const result = applyResult?.ok ? applyResult : dryRunResult;
  const importSummary = result?.ok ? result.summary : null;
  const rejectedTracks = result?.ok ? result.rejectedTracks : [];
  const sampleItems = result?.ok ? result.items.slice(0, 15) : [];

  return (
    <>
      <section className={styles.surface}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>YouTube Audio Library</h2>
            <p>{message}</p>
          </div>
          <span className={styles.badge}>{phase}</span>
        </div>
        <div className={styles.compactGrid}>
          <span className={styles.badge}>{manifestFileName ?? "No manifest"}</span>
          <span className={styles.badge}>{audioFiles.length} audio files selected</span>
          <span className={styles.badge}>{manifestAudioNames.length} manifest audio references</span>
          {uploadProgress ? <span className={styles.badge}>{uploadProgress}</span> : null}
        </div>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Local Files</h2>
            <p>Files remain in this browser until Upload & dry-run is pressed.</p>
          </div>
        </div>
        <div className={styles.formGrid}>
          <label>
            <span>Typed manifest JSON</span>
            <input accept="application/json,.json" onChange={(event) => void onManifestSelected(event)} type="file" />
          </label>
          <label>
            <span>Downloaded audio files</span>
            <input accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac" multiple onChange={onAudioSelected} type="file" />
          </label>
        </div>
        {missingAudioNames.length > 0 ? (
          <p className={styles.warningText}>
            Missing selected audio: {missingAudioNames.slice(0, 8).join(", ")}{missingAudioNames.length > 8 ? "..." : ""}
          </p>
        ) : null}
      </section>

      <section className={styles.adminSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Review & Apply</h2>
            <p>Dry-run uploads referenced audio, then validates evidence through the existing import API.</p>
          </div>
          <div className={styles.rowActions}>
            <button
              className={styles.primaryButton}
              disabled={!manifest || phase === "uploading" || phase === "dry-run" || phase === "applying"}
              onClick={() => void runDryRun()}
              type="button"
            >
              Upload & dry-run
            </button>
            <button
              className={styles.primaryButton}
              disabled={!dryRunResult?.ok || !preparedManifest || phase === "applying" || phase === "applied"}
              onClick={() => void applyImport()}
              type="button"
            >
              Apply import
            </button>
          </div>
        </div>

        {importSummary ? (
          <div className={styles.compactGrid}>
            <span className={styles.badge}>{importSummary.received} received</span>
            <span className={styles.badge}>{importSummary.accepted} accepted</span>
            <span className={styles.badge}>{importSummary.rejected} rejected</span>
            <span className={styles.badge}>{importSummary.created} created</span>
            <span className={styles.badge}>{importSummary.updated} updated</span>
            <span className={styles.badge}>{importSummary.unchanged} unchanged</span>
            <span className={styles.badge}>{importSummary.markedUnavailable} unavailable</span>
            <span className={styles.badge}>{importSummary.licenseSnapshotsAppended} snapshots</span>
          </div>
        ) : null}
      </section>

      {rejectedTracks.length > 0 ? (
        <section className={styles.adminSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Rejected Tracks</h2>
              <p>Server validation rejected these rows; no private paths or credentials are shown.</p>
            </div>
          </div>
          <div className={styles.tableGrid}>
            {rejectedTracks.slice(0, 25).map((track) => (
              <div className={styles.compactRow} key={`${track.index}:${track.externalId ?? "none"}:${track.reason}`}>
                <span className={styles.rowTitle}>
                  <strong>{track.title ?? track.externalId ?? `Row ${track.index + 1}`}</strong>
                  <span>{track.reason}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {sampleItems.length > 0 ? (
        <section className={styles.adminSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Sample Actions</h2>
              <p>First import actions returned by the API.</p>
            </div>
          </div>
          <div className={styles.tableGrid}>
            {sampleItems.map((item) => (
              <div className={styles.compactRow} key={`${item.externalId ?? "none"}:${item.title ?? "untitled"}:${item.action}`}>
                <span className={styles.rowTitle}>
                  <strong>{item.title ?? item.externalId ?? "Untitled"}</strong>
                  <span>{item.action}{item.reason ? ` / ${item.reason}` : ""}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
};

const IncompetechImportWorkflow = (): React.ReactNode => {
  const [applyConfirmed, setApplyConfirmed] = useState(false);
  const [audioFiles, setAudioFiles] = useState<readonly File[]>([]);
  const [applyResult, setApplyResult] = useState<MusicYouTubeAudioLibraryImportResult | null>(null);
  const [dryRunResult, setDryRunResult] = useState<MusicYouTubeAudioLibraryImportResult | null>(null);
  const [dryRunResultFingerprint, setDryRunResultFingerprint] = useState<number | null>(null);
  const [manifest, setManifest] = useState<MusicIncompetechManifest | null>(null);
  const [manifestFileName, setManifestFileName] = useState<string | null>(null);
  const [manifestSha256, setManifestSha256] = useState<string | null>(null);
  const [message, setMessage] = useState(createInitialIncompetechMessage);
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [preparedManifest, setPreparedManifest] = useState<MusicIncompetechManifest | null>(null);
  const [preparedManifestFingerprint, setPreparedManifestFingerprint] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const applyRequestRef = useRef(0);
  const dryRunRequestRef = useRef(0);
  const manifestRequestRef = useRef(0);
  const selectionFingerprintRef = useRef(0);
  const audioSelectionReport = useMemo(
    () => manifest ? analyzeIncompetechAudioSelection(manifest, audioFiles) : null,
    [audioFiles, manifest]
  );
  const dirty = hasUnsavedImportSelection({
    applied: phase === "applied",
    audioFileCount: audioFiles.length,
    manifestSelected: Boolean(manifest),
    prepared: Boolean(preparedManifest)
  });

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const beforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    const clickGuard = (event: MouseEvent): void => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;

      if (target && !window.confirm("Leave this import workflow and discard selected local files?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", clickGuard, { capture: true });

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", clickGuard, { capture: true });
    };
  }, [dirty]);

  const resetServerState = (): void => {
    setApplyConfirmed(false);
    setApplyResult(null);
    setDryRunResult(null);
    setDryRunResultFingerprint(null);
    setPreparedManifest(null);
    setPreparedManifestFingerprint(null);
    setUploadProgress(null);
  };

  const invalidateSelection = (): number => {
    const nextFingerprint = selectionFingerprintRef.current + 1;
    selectionFingerprintRef.current = nextFingerprint;
    dryRunRequestRef.current += 1;
    applyRequestRef.current += 1;

    return nextFingerprint;
  };

  const isCurrentSelection = (selectionFingerprint: number): boolean =>
    selectionFingerprintRef.current === selectionFingerprint;

  const isCurrentDryRun = (guard: IncompetechDryRunGuard): boolean =>
    dryRunRequestRef.current === guard.requestId
    && selectionFingerprintRef.current === guard.selectionFingerprint;

  const onManifestSelected = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    invalidateSelection();
    const manifestRequestId = manifestRequestRef.current + 1;
    manifestRequestRef.current = manifestRequestId;
    const file = event.currentTarget.files?.[0] ?? null;
    resetServerState();
    setPhase("idle");
    setManifest(null);
    setManifestFileName(null);
    setManifestSha256(null);

    if (!file) {
      setMessage(createInitialIncompetechMessage);
      return;
    }

    try {
      const text = await readFileAsText(file);
      const digest = await sha256Text(text);
      const parsed = JSON.parse(text) as unknown;

      if (manifestRequestRef.current !== manifestRequestId) {
        return;
      }
      if (digest !== expectedIncompetechManifestSha256) {
        setPhase("error");
        setMessage("Incompetech manifest SHA-256 does not match the reviewed frozen manifest.");
        return;
      }
      if (!isIncompetechManifest(parsed)) {
        setPhase("error");
        setMessage("Manifest must be the typed Incompetech CC BY 4.0 export.");
        return;
      }

      setManifest(parsed);
      setManifestFileName(safeImportFileName(file.name));
      setManifestSha256(digest);
      setMessage(`${parsed.tracks.length} Incompetech rows selected. Audio files are still local.`);
    } catch {
      if (manifestRequestRef.current !== manifestRequestId) {
        return;
      }
      setPhase("error");
      setMessage("Could not parse Incompetech manifest JSON.");
    }
  };

  const onAudioSelected = (event: ChangeEvent<HTMLInputElement>): void => {
    invalidateSelection();
    resetServerState();
    setPhase("idle");
    setAudioFiles([...event.currentTarget.files ?? []]);
    setMessage("Incompetech MP3 files selected locally. Nothing has been uploaded yet.");
  };

  const uploadReferencedAudio = async (
    guard: IncompetechDryRunGuard
  ): Promise<Map<string, ImportAudioUpload> | null> => {
    if (!isCurrentDryRun(guard)) {
      return null;
    }
    if (!manifest) {
      setMessage("Select the Incompetech manifest first.");
      return null;
    }

    const report = analyzeIncompetechAudioSelection(manifest, audioFiles);
    if (report.missing.length > 0 || report.extra.length > 0 || report.duplicates.length > 0) {
      setPhase("error");
      setMessage(
        `Audio selection mismatch: ${report.missing.length} missing, ${report.extra.length} extra, ${report.duplicates.length} duplicate.`
      );
      return null;
    }

    const fileBySha = indexIncompetechFilesBySha(audioFiles);
    const uploads = new Map<string, ImportAudioUpload>();

    for (const track of manifest.tracks) {
      if (!isCurrentDryRun(guard)) {
        return null;
      }

      const expectedSha256 = track.audio.sha256?.toLowerCase() ?? "";
      const file = fileBySha.get(expectedSha256);
      if (!file) {
        setPhase("error");
        setMessage(`Missing upload candidate for ${track.title}.`);
        return null;
      }

      const safeFileName = safeImportFileName(file.name);
      setUploadProgress(`Uploading ${track.title}`);
      const [dataBase64, localSha256] = await Promise.all([
        readFileAsBase64(file),
        sha256Hex(file)
      ]);
      if (!isCurrentDryRun(guard)) {
        return null;
      }

      if (localSha256 !== expectedSha256) {
        setPhase("error");
        setMessage(`Selected MP3 bytes do not match manifest evidence for ${track.title}.`);
        return null;
      }

      const response = await uploadAdminMusicAudio({
        filename: safeFileName,
        contentType: contentTypeForFile(file),
        dataBase64
      });
      if (!isCurrentDryRun(guard)) {
        return null;
      }

      if (!response.payload.ok) {
        setPhase("error");
        setMessage(`Upload blocked for ${track.title}: ${response.payload.reason}`);
        return null;
      }

      if (response.payload.upload.sha256.toLowerCase() !== expectedSha256) {
        setPhase("error");
        setMessage(`Checksum mismatch after upload for ${track.title}.`);
        return null;
      }

      uploads.set(expectedSha256, response.payload.upload);
    }

    return uploads;
  };

  const runDryRun = async (): Promise<void> => {
    if (!manifest) {
      setMessage("Select the Incompetech manifest first.");
      return;
    }

    const guard: IncompetechDryRunGuard = {
      requestId: dryRunRequestRef.current + 1,
      selectionFingerprint: selectionFingerprintRef.current
    };
    dryRunRequestRef.current = guard.requestId;
    setPhase("uploading");
    resetServerState();

    try {
      const uploads = await uploadReferencedAudio(guard);
      if (!uploads) {
        return;
      }

      const prepared = buildPreparedIncompetechManifest(manifest, uploads);
      if (!prepared.ok) {
        setPhase("error");
        setMessage(prepared.errors.slice(0, 5).join(" "));
        return;
      }

      setPreparedManifest(prepared.manifest);
      setPreparedManifestFingerprint(guard.selectionFingerprint);
      setPhase("dry-run");
      setUploadProgress(`Uploaded ${prepared.uploadedTrackCount} reviewed Incompetech MP3 files.`);
      const response = await dryRunIncompetechImport(prepared.manifest);

      if (!isCurrentDryRun(guard)) {
        return;
      }
      setDryRunResult(response.payload);
      setDryRunResultFingerprint(guard.selectionFingerprint);
      if (!response.payload.ok) {
        setPhase("error");
        setMessage(`Incompetech dry-run blocked: ${resultReason(response.payload)}.`);
        return;
      }

      setPhase("ready");
      setMessage(`Incompetech dry-run ready: ${summarizeImportCounts(response.payload.summary)}.`);
    } catch {
      if (!isCurrentDryRun(guard)) {
        return;
      }
      setPhase("error");
      setMessage("Incompetech dry-run failed before apply.");
    }
  };

  const applyImport = async (): Promise<void> => {
    const selectionFingerprint = selectionFingerprintRef.current;
    if (
      !preparedManifest
      || !dryRunResult?.ok
      || !applyConfirmed
      || preparedManifestFingerprint !== selectionFingerprint
      || dryRunResultFingerprint !== selectionFingerprint
    ) {
      setMessage("Run a successful dry-run and confirm the production apply before applying.");
      return;
    }

    const requestId = applyRequestRef.current + 1;
    applyRequestRef.current = requestId;
    const manifestForApply = preparedManifest;
    setPhase("applying");
    setMessage("Applying Incompetech import to production catalog...");

    try {
      const response = await applyIncompetechImport(manifestForApply);

      if (applyRequestRef.current !== requestId || !isCurrentSelection(selectionFingerprint)) {
        return;
      }
      setApplyResult(response.payload);
      setApplyConfirmed(false);
      if (!response.payload.ok) {
        setPhase("error");
        setMessage(`Incompetech apply blocked: ${resultReason(response.payload)}.`);
        return;
      }

      setPhase("applied");
      setMessage(`Incompetech import applied: ${summarizeImportCounts(response.payload.summary)}. Run a fresh dry-run to verify idempotency.`);
    } catch {
      if (applyRequestRef.current !== requestId || !isCurrentSelection(selectionFingerprint)) {
        return;
      }
      setPhase("error");
      setMessage("Incompetech apply failed.");
    }
  };

  const currentSelectionFingerprint = selectionFingerprintRef.current;
  const hasCurrentDryRun = Boolean(
    dryRunResult?.ok
    && preparedManifest
    && preparedManifestFingerprint === currentSelectionFingerprint
    && dryRunResultFingerprint === currentSelectionFingerprint
  );
  const result = applyResult ?? dryRunResult;
  const importSummary = result?.ok ? result.summary : null;
  const rejectedTracks = result?.ok ? result.rejectedTracks : [];
  const sampleItems = result?.ok ? result.items.slice(0, 20) : [];

  return (
    <>
      <section className={styles.surface}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Incompetech CC BY 4.0</h2>
            <p>{message}</p>
          </div>
          <span className={styles.badge}>{phase}</span>
        </div>
        <div className={styles.compactGrid}>
          <span className={styles.badge}>{manifestFileName ?? "No manifest"}</span>
          <span className={styles.badge}>{audioFiles.length} MP3 files selected</span>
          <span className={styles.badge}>{audioSelectionReport?.expectedCount ?? 0} expected MP3 files</span>
          <span className={styles.badge}>{manifestSha256 === expectedIncompetechManifestSha256 ? "Frozen manifest verified" : "Manifest hash pending"}</span>
          {uploadProgress ? <span className={styles.badge}>{uploadProgress}</span> : null}
        </div>
      </section>

      <section className={styles.adminSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Incompetech Local Files</h2>
            <p>The reviewed manifest and MP3s stay in this browser until Upload & dry-run is pressed.</p>
          </div>
        </div>
        <div className={styles.formGrid}>
          <label>
            <span>Reviewed manifest JSON</span>
            <input accept="application/json,.json" onChange={(event) => void onManifestSelected(event)} type="file" />
          </label>
          <label>
            <span>Reviewed MP3 files</span>
            <input accept="audio/mpeg,.mp3" multiple onChange={onAudioSelected} type="file" />
          </label>
        </div>
        {audioSelectionReport && (
          audioSelectionReport.missing.length > 0
          || audioSelectionReport.extra.length > 0
          || audioSelectionReport.duplicates.length > 0
        ) ? (
          <p className={styles.warningText}>
            Audio selection mismatch: {audioSelectionReport.missing.length} missing,
            {" "}{audioSelectionReport.extra.length} extra,
            {" "}{audioSelectionReport.duplicates.length} duplicate.
          </p>
        ) : null}
      </section>

      <section className={styles.adminSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Incompetech Review & Apply</h2>
            <p>Dry-run uploads the 20 matching MP3s, then validates the reviewed manifest through the Incompetech import API.</p>
          </div>
          <div className={styles.rowActions}>
            <button
              className={styles.primaryButton}
              disabled={!manifest || phase === "uploading" || phase === "dry-run" || phase === "applying"}
              onClick={() => void runDryRun()}
              type="button"
            >
              Upload & dry-run Incompetech
            </button>
            <label>
              <span>Confirm irreversible production Incompetech apply</span>
              <input
                checked={applyConfirmed}
                disabled={!hasCurrentDryRun || phase === "applying" || phase === "applied"}
                onChange={(event) => setApplyConfirmed(event.currentTarget.checked)}
                type="checkbox"
              />
            </label>
            <button
              className={styles.primaryButton}
              disabled={!hasCurrentDryRun || !applyConfirmed || phase === "applying" || phase === "applied"}
              onClick={() => void applyImport()}
              type="button"
            >
              Apply Incompetech import
            </button>
          </div>
        </div>

        {result && !result.ok ? (
          <p className={styles.warningText}>Server response: {resultReason(result)}</p>
        ) : null}
        {importSummary ? (
          <div className={styles.compactGrid}>
            <span className={styles.badge}>{importSummary.received} received</span>
            <span className={styles.badge}>{importSummary.accepted} accepted</span>
            <span className={styles.badge}>{importSummary.rejected} rejected</span>
            <span className={styles.badge}>{importSummary.created} created</span>
            <span className={styles.badge}>{importSummary.updated} updated</span>
            <span className={styles.badge}>{importSummary.unchanged} unchanged</span>
            <span className={styles.badge}>{importSummary.markedUnavailable} unavailable</span>
            <span className={styles.badge}>{importSummary.licenseSnapshotsAppended} snapshots</span>
          </div>
        ) : null}
      </section>

      {rejectedTracks.length > 0 ? (
        <section className={styles.adminSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Incompetech Rejected Tracks</h2>
              <p>Server validation rejected these rows; private manifest evidence is not rendered.</p>
            </div>
          </div>
          <div className={styles.tableGrid}>
            {rejectedTracks.slice(0, 25).map((track) => (
              <div className={styles.compactRow} key={`${track.index}:${track.externalId ?? "none"}:${track.reason}`}>
                <span className={styles.rowTitle}>
                  <strong>{track.title ?? track.externalId ?? `Row ${track.index + 1}`}</strong>
                  <span>{track.reason}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {sampleItems.length > 0 ? (
        <section className={styles.adminSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>Incompetech Actions</h2>
              <p>Server actions returned by the API.</p>
            </div>
          </div>
          <div className={styles.tableGrid}>
            {sampleItems.map((item) => (
              <div className={styles.compactRow} key={`${item.externalId ?? "none"}:${item.title ?? "untitled"}:${item.action}`}>
                <span className={styles.rowTitle}>
                  <strong>{item.title ?? item.externalId ?? "Untitled"}</strong>
                  <span>{item.action}{item.reason ? ` / ${item.reason}` : ""}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
};

export const AdminMusicImportClient = (): React.ReactNode => {
  return (
    <>
      <MusicAdminHeader
        description="Upload a typed manifest and matching downloaded audio, dry-run the existing import API, then explicitly apply when the server accepts it."
        title="Music Import"
      />
      <YouTubeAudioLibraryImportWorkflow />
      <IncompetechImportWorkflow />
    </>
  );
};

export default AdminMusicImportClient;
