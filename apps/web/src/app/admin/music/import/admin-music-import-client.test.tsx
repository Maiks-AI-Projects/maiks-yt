import { createHash, webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";

import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expectedIncompetechManifestSha256 } from "./admin-music-import-workflow.service";

import { AdminMusicImportClient } from "./admin-music-import-client";

const frozenManifestPath = "/home/michael/Documents/Codex/2026-09-01/maiks-music-acquisition/outputs/incompetech/manifests/incompetech-ccby4-20-track-manifest.json";

const mocks = vi.hoisted(() => ({
  applyIncompetechImport: vi.fn(),
  applyYouTubeAudioLibraryImport: vi.fn(),
  dryRunIncompetechImport: vi.fn(),
  dryRunYouTubeAudioLibraryImport: vi.fn(),
  uploadAdminMusicAudio: vi.fn()
}));

vi.mock("../../../dev-auth-token", () => ({
  captureDevAuthTokenFromUrl: vi.fn()
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: {
    readonly children: React.ReactNode;
    readonly href: string;
  }) => <a href={href} {...props}>{children}</a>
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/music/import"
}));

vi.mock("../../../music/music-api.service", () => ({
  applyIncompetechImport: mocks.applyIncompetechImport,
  applyYouTubeAudioLibraryImport: mocks.applyYouTubeAudioLibraryImport,
  dryRunIncompetechImport: mocks.dryRunIncompetechImport,
  dryRunYouTubeAudioLibraryImport: mocks.dryRunYouTubeAudioLibraryImport,
  uploadAdminMusicAudio: mocks.uploadAdminMusicAudio
}));

type TestFile = File & {
  readonly bytes: Buffer;
  readonly textValue?: string;
};

class TestFileReader {
  public result: string | ArrayBuffer | null = null;
  readonly #listeners = new Map<string, () => void>();

  public addEventListener(name: string, listener: () => void): void {
    this.#listeners.set(name, listener);
  }

  public readAsDataURL(file: TestFile): void {
    this.result = `data:${file.type};base64,${file.bytes.toString("base64")}`;
    this.#listeners.get("load")?.();
  }
}

const textOf = (renderer: ReactTestRenderer): string =>
  renderer.root.findAll(() => true)
    .flatMap((node) => typeof node.children === "string" ? [node.children] : node.children)
    .filter((child): child is string => typeof child === "string")
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();

const buttonText = (props: { readonly children?: unknown }): string =>
  Array.isArray(props.children) ? props.children.join("") : String(props.children ?? "");

const findButton = (renderer: ReactTestRenderer, label: string) => {
  const button = renderer.root.findAllByType("button")
    .find((candidate) => buttonText(candidate.props).includes(label));
  if (!button) {
    throw new Error(`Missing button: ${label}`);
  }

  return button;
};

const findIncompetechManifestInput = (renderer: ReactTestRenderer): ReactTestInstance => {
  const input = renderer.root.findAllByType("input")
    .filter((candidate) => candidate.props.accept === "application/json,.json")
    .slice(1)[0];
  if (!input) {
    throw new Error("Missing Incompetech manifest input.");
  }

  return input;
};

const findIncompetechAudioInput = (renderer: ReactTestRenderer): ReactTestInstance => {
  const input = renderer.root.findAllByType("input")
    .find((candidate) => candidate.props.accept === "audio/mpeg,.mp3");
  if (!input) {
    throw new Error("Missing Incompetech audio input.");
  }

  return input;
};

const findApplyConfirmationInput = (renderer: ReactTestRenderer): ReactTestInstance => {
  const input = renderer.root.findAllByType("input")
    .find((candidate) => candidate.props.type === "checkbox");
  if (!input) {
    throw new Error("Missing Incompetech apply confirmation.");
  }

  return input;
};

const waitForAssertion = async (assertion: () => void): Promise<void> => {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }

  if (lastError) {
    throw lastError;
  }
};

const fileFromBytes = (input: {
  readonly bytes: Buffer;
  readonly name: string;
  readonly textValue?: string;
  readonly type: string;
  readonly webkitRelativePath?: string;
}): TestFile => ({
  arrayBuffer: async () => input.bytes.buffer.slice(
    input.bytes.byteOffset,
    input.bytes.byteOffset + input.bytes.byteLength
  ),
  bytes: input.bytes,
  name: input.name,
  size: input.bytes.byteLength,
  text: async () => input.textValue ?? input.bytes.toString("utf8"),
  textValue: input.textValue,
  type: input.type,
  webkitRelativePath: input.webkitRelativePath ?? ""
}) as TestFile;

const importSummary = {
  accepted: 20,
  created: 20,
  licenseSnapshotsAppended: 20,
  markedUnavailable: 0,
  received: 20,
  rejected: 0,
  unchanged: 0,
  updated: 0
};

const dryRunResponse = (input?: {
  readonly itemTitle?: string;
  readonly summary?: typeof importSummary;
}) => ({
  payload: {
    ok: true,
    items: [{
      action: "create",
      externalId: "USUAN2300003",
      reason: null,
      title: input?.itemTitle ?? "Sergio's Magic Dustbin"
    }],
    mode: "dry-run",
    rejectedTracks: [],
    summary: input?.summary ?? importSummary
  },
  status: 200
});

const applyResponse = {
  payload: {
    ok: true,
    items: [{ action: "unchanged", externalId: "USUAN2300003", reason: null, title: "Sergio's Magic Dustbin" }],
    mode: "apply",
    rejectedTracks: [],
    summary: { ...importSummary, created: 0, licenseSnapshotsAppended: 0, unchanged: 20 }
  },
  status: 200
};

const deferred = <T,>(): {
  readonly promise: Promise<T>;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (value: T) => void;
} => {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    reject = innerReject;
    resolve = innerResolve;
  });

  return { promise, reject, resolve };
};

const loadFrozenIncompetechSelection = async (): Promise<{
  readonly audioFiles: readonly TestFile[];
  readonly manifestText: string;
}> => {
  const manifestText = await readFile(frozenManifestPath, "utf8");
  expect(createHash("sha256").update(manifestText).digest("hex")).toBe(expectedIncompetechManifestSha256);
  const manifest = JSON.parse(manifestText) as {
    readonly tracks: readonly {
      readonly audio: {
        readonly path: string;
        readonly sha256: string;
      };
      readonly normalizedGenre: string;
    }[];
  };
  const audioFiles = await Promise.all(manifest.tracks.map(async (track) => fileFromBytes({
    bytes: await readFile(track.audio.path),
    name: `${track.audio.sha256}.mp3`,
    type: "audio/mpeg",
    webkitRelativePath: `library/${track.normalizedGenre}/${track.audio.sha256}.mp3`
  })));

  return { audioFiles, manifestText };
};

const selectIncompetechManifest = async (
  renderer: ReactTestRenderer,
  manifestText: string,
  name = "incompetech-ccby4-20-track-manifest.json"
): Promise<void> => {
  const incompetechManifestInput = findIncompetechManifestInput(renderer);

  await act(async () => {
    await incompetechManifestInput.props.onChange({
      currentTarget: {
        files: [fileFromBytes({
          bytes: Buffer.from(manifestText, "utf8"),
          name,
          textValue: manifestText,
          type: "application/json"
        })]
      }
    });
  });
};

const selectIncompetechAudio = async (
  renderer: ReactTestRenderer,
  audioFiles: readonly TestFile[]
): Promise<void> => {
  const incompetechAudioInput = findIncompetechAudioInput(renderer);

  await act(async () => {
    incompetechAudioInput.props.onChange({ currentTarget: { files: audioFiles } });
  });
};

const selectFrozenIncompetech = async (
  renderer: ReactTestRenderer,
  selection: { readonly audioFiles: readonly TestFile[]; readonly manifestText: string }
): Promise<void> => {
  await selectIncompetechManifest(renderer, selection.manifestText);
  await selectIncompetechAudio(renderer, selection.audioFiles);
};

const renderClient = async (): Promise<ReactTestRenderer> => {
  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(<AdminMusicImportClient />);
  });
  if (!renderer) {
    throw new Error("Import client did not render.");
  }

  return renderer;
};

beforeEach(() => {
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    confirm: vi.fn(() => true),
    crypto: webcrypto,
    location: { href: "https://maiks.yt/admin/music/import" },
    removeEventListener: vi.fn()
  });
  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  });
  vi.stubGlobal("FileReader", TestFileReader);
  mocks.uploadAdminMusicAudio.mockImplementation(async (input: { readonly filename: string }) => {
    const sha256 = input.filename.replace(/\.mp3$/u, "");
    return {
      payload: {
        ok: true,
        upload: {
          contentType: "audio/mpeg",
          filename: input.filename,
          sha256,
          sizeBytes: 123,
          storageRef: `music-audio:${sha256}:${input.filename}`
        }
      },
      status: 200
    };
  });
  mocks.dryRunIncompetechImport.mockResolvedValue(dryRunResponse());
  mocks.applyIncompetechImport.mockResolvedValue(applyResponse);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("admin music import client", () => {
  it("keeps the YouTube workflow visible while adding a separated Incompetech workflow", async () => {
    const renderer = await renderClient();
    const text = textOf(renderer);

    expect(text).toContain("YouTube Audio Library");
    expect(text).toContain("Incompetech CC BY 4.0");

    await act(async () => {
      renderer.unmount();
    });
  });

  it("dry-runs the frozen Incompetech manifest, gates apply, and keeps private evidence out of rendered text", async () => {
    const selection = await loadFrozenIncompetechSelection();
    const renderer = await renderClient();
    await selectFrozenIncompetech(renderer, selection);

    const applyButtonBeforeDryRun = findButton(renderer, "Apply Incompetech import");
    expect(applyButtonBeforeDryRun.props.disabled).toBe(true);

    await act(async () => {
      findButton(renderer, "Upload & dry-run Incompetech").props.onClick();
    });
    await waitForAssertion(() => {
      expect(mocks.dryRunIncompetechImport).toHaveBeenCalledTimes(1);
    });

    expect(mocks.uploadAdminMusicAudio).toHaveBeenCalledTimes(20);
    expect(findButton(renderer, "Apply Incompetech import").props.disabled).toBe(true);
    expect(textOf(renderer)).toContain("20 received");
    expect(textOf(renderer)).toContain("20 snapshots");

    const confirmApply = findApplyConfirmationInput(renderer);
    await act(async () => {
      await confirmApply.props.onChange({ currentTarget: { checked: true } });
    });
    expect(findButton(renderer, "Apply Incompetech import").props.disabled).toBe(false);

    await act(async () => {
      findButton(renderer, "Apply Incompetech import").props.onClick();
    });
    await waitForAssertion(() => {
      expect(mocks.applyIncompetechImport).toHaveBeenCalledTimes(1);
    });

    const renderedText = textOf(renderer);
    expect(renderedText).toContain("20 received");
    expect(renderedText).toContain("0 snapshots");
    expect(renderedText).toContain("Run a fresh dry-run to verify idempotency");
    expect(renderedText).toContain("Sergio's Magic Dustbin");
    expect(renderedText).not.toContain("incompetech.com/music/royalty-free/mp3-royaltyfree");
    expect(renderedText).not.toContain("music-audio:");
    expect(renderedText).not.toContain("/home/michael/Documents/Codex/2026-09-01");
    expect(renderedText).not.toContain("licensePayload");

    await act(async () => {
      renderer.unmount();
    });
  });

  it("ignores a completed Incompetech dry-run after the audio selection changes", async () => {
    const selection = await loadFrozenIncompetechSelection();
    const staleDryRun = deferred<ReturnType<typeof dryRunResponse>>();
    mocks.dryRunIncompetechImport.mockReturnValueOnce(staleDryRun.promise);
    const renderer = await renderClient();
    await selectFrozenIncompetech(renderer, selection);

    await act(async () => {
      findButton(renderer, "Upload & dry-run Incompetech").props.onClick();
    });
    await waitForAssertion(() => {
      expect(mocks.dryRunIncompetechImport).toHaveBeenCalledTimes(1);
    });

    await selectIncompetechAudio(renderer, selection.audioFiles.slice(0, 19));
    await act(async () => {
      staleDryRun.resolve(dryRunResponse());
      await staleDryRun.promise;
    });

    const renderedText = textOf(renderer);
    expect(renderedText).toContain("19 MP3 files selected");
    expect(renderedText).toContain("Nothing has been uploaded yet");
    expect(renderedText).not.toContain("Incompetech dry-run ready");
    expect(renderedText).not.toContain("20 received");
    expect(findApplyConfirmationInput(renderer).props.disabled).toBe(true);
    expect(findButton(renderer, "Apply Incompetech import").props.disabled).toBe(true);

    await act(async () => {
      renderer.unmount();
    });
  });

  it("ignores a completed Incompetech dry-run after the manifest selection changes", async () => {
    const selection = await loadFrozenIncompetechSelection();
    const staleDryRun = deferred<ReturnType<typeof dryRunResponse>>();
    mocks.dryRunIncompetechImport.mockReturnValueOnce(staleDryRun.promise);
    const renderer = await renderClient();
    await selectFrozenIncompetech(renderer, selection);

    await act(async () => {
      findButton(renderer, "Upload & dry-run Incompetech").props.onClick();
    });
    await waitForAssertion(() => {
      expect(mocks.dryRunIncompetechImport).toHaveBeenCalledTimes(1);
    });

    await selectIncompetechManifest(renderer, selection.manifestText, "replacement-incompetech-manifest.json");
    await act(async () => {
      staleDryRun.resolve(dryRunResponse());
      await staleDryRun.promise;
    });

    const renderedText = textOf(renderer);
    expect(renderedText).toContain("replacement-incompetech-manifest.json");
    expect(renderedText).not.toContain("Incompetech dry-run ready");
    expect(renderedText).not.toContain("20 received");
    expect(findApplyConfirmationInput(renderer).props.disabled).toBe(true);
    expect(findButton(renderer, "Apply Incompetech import").props.disabled).toBe(true);

    await act(async () => {
      renderer.unmount();
    });
  });

  it("does not let a stale rejected dry-run overwrite the current Incompetech selection state", async () => {
    const selection = await loadFrozenIncompetechSelection();
    const staleDryRun = deferred<ReturnType<typeof dryRunResponse>>();
    mocks.dryRunIncompetechImport.mockReturnValueOnce(staleDryRun.promise);
    const renderer = await renderClient();
    await selectFrozenIncompetech(renderer, selection);

    await act(async () => {
      findButton(renderer, "Upload & dry-run Incompetech").props.onClick();
    });
    await waitForAssertion(() => {
      expect(mocks.dryRunIncompetechImport).toHaveBeenCalledTimes(1);
    });

    await selectIncompetechAudio(renderer, selection.audioFiles.slice(0, 19));
    await act(async () => {
      staleDryRun.reject(new Error("stale dry-run failed"));
      await Promise.resolve();
      await Promise.resolve();
    });

    const renderedText = textOf(renderer);
    expect(renderedText).toContain("19 MP3 files selected");
    expect(renderedText).not.toContain("Incompetech dry-run failed before apply");
    expect(renderedText).not.toContain("Server response");
    expect(findButton(renderer, "Apply Incompetech import").props.disabled).toBe(true);

    await act(async () => {
      renderer.unmount();
    });
  });

  it("keeps only the latest rapid Incompetech dry-run eligible to arm apply", async () => {
    const selection = await loadFrozenIncompetechSelection();
    const currentDryRun = deferred<ReturnType<typeof dryRunResponse>>();
    mocks.dryRunIncompetechImport.mockReturnValueOnce(currentDryRun.promise);
    const renderer = await renderClient();
    await selectFrozenIncompetech(renderer, selection);
    const dryRunButton = findButton(renderer, "Upload & dry-run Incompetech");

    await act(async () => {
      dryRunButton.props.onClick();
      dryRunButton.props.onClick();
    });
    await waitForAssertion(() => {
      expect(mocks.dryRunIncompetechImport).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      currentDryRun.resolve(dryRunResponse({
        itemTitle: "Current dry-run result",
        summary: { ...importSummary, created: 0, unchanged: 20 }
      }));
      await currentDryRun.promise;
    });
    expect(textOf(renderer)).toContain("20 unchanged");

    const renderedText = textOf(renderer);
    expect(renderedText).toContain("Current dry-run result");
    expect(renderedText).toContain("20 unchanged");

    const confirmApply = findApplyConfirmationInput(renderer);
    await act(async () => {
      await confirmApply.props.onChange({ currentTarget: { checked: true } });
    });
    expect(findButton(renderer, "Apply Incompetech import").props.disabled).toBe(false);

    await act(async () => {
      renderer.unmount();
    });
  });

  it("refuses a stale apply handler after the Incompetech selection fingerprint changes", async () => {
    const selection = await loadFrozenIncompetechSelection();
    const renderer = await renderClient();
    await selectFrozenIncompetech(renderer, selection);

    await act(async () => {
      findButton(renderer, "Upload & dry-run Incompetech").props.onClick();
    });
    await waitForAssertion(() => {
      expect(mocks.dryRunIncompetechImport).toHaveBeenCalledTimes(1);
      expect(textOf(renderer)).toContain("Incompetech dry-run ready");
    });

    const confirmApply = findApplyConfirmationInput(renderer);
    await act(async () => {
      await confirmApply.props.onChange({ currentTarget: { checked: true } });
    });
    const staleApplyButton = findButton(renderer, "Apply Incompetech import");
    expect(staleApplyButton.props.disabled).toBe(false);

    await selectIncompetechAudio(renderer, selection.audioFiles.slice(0, 19));
    await act(async () => {
      staleApplyButton.props.onClick();
    });

    expect(mocks.applyIncompetechImport).not.toHaveBeenCalled();
    expect(findButton(renderer, "Apply Incompetech import").props.disabled).toBe(true);
    expect(textOf(renderer)).toContain("Run a successful dry-run and confirm the production apply before applying");

    await act(async () => {
      renderer.unmount();
    });
  });

  it("renders signed-out and forbidden Incompetech dry-run responses truthfully", async () => {
    mocks.dryRunIncompetechImport.mockResolvedValueOnce({
      payload: { ok: false, reason: "not_authenticated" },
      status: 401
    });
    const selection = await loadFrozenIncompetechSelection();
    const renderer = await renderClient();
    await selectFrozenIncompetech(renderer, selection);
    await act(async () => {
      findButton(renderer, "Upload & dry-run Incompetech").props.onClick();
    });
    await waitForAssertion(() => {
      expect(textOf(renderer)).toContain("Server response: not_authenticated");
    });

    expect(textOf(renderer)).toContain("Server response: not_authenticated");
    expect(textOf(renderer)).not.toContain("Import applied");

    await act(async () => {
      renderer.unmount();
    });

    mocks.dryRunIncompetechImport.mockResolvedValueOnce({
      payload: { ok: false, reason: "music_admin_forbidden" },
      status: 403
    });
    const forbiddenRenderer = await renderClient();
    await selectFrozenIncompetech(forbiddenRenderer, selection);
    await act(async () => {
      findButton(forbiddenRenderer, "Upload & dry-run Incompetech").props.onClick();
    });
    await waitForAssertion(() => {
      expect(textOf(forbiddenRenderer)).toContain("Server response: music_admin_forbidden");
    });

    expect(textOf(forbiddenRenderer)).toContain("Server response: music_admin_forbidden");
    expect(textOf(forbiddenRenderer)).not.toContain("Import applied");

    await act(async () => {
      forbiddenRenderer.unmount();
    });
  });
});
