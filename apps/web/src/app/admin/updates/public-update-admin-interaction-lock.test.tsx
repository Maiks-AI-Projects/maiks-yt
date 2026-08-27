import { renderToStaticMarkup } from "react-dom/server";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicUpdateSource } from "@maiks-yt/domain/updates";

import { PublicUpdateAdminView } from "./public-update-admin-client";
import { toUpdateForm } from "./public-update-admin.rules";
import {
  usePublicUpdateAdminWorkspace,
  type PublicUpdateAdminWorkspaceController
} from "./public-update-admin-workspace.service";

const draftUpdate: PublicUpdateSource = {
  id: "saved-draft",
  slug: "saved-draft",
  title: "Saved draft",
  summary: "Saved summary",
  body: "Saved body",
  kind: "post",
  status: "draft",
  visibility: "hidden",
  publishedAt: null,
  isPinned: false,
  isExample: false,
  updatedAt: "2026-08-28T12:00:00.000Z"
};

const createController = (
  overrides: Partial<PublicUpdateAdminWorkspaceController> = {}
): PublicUpdateAdminWorkspaceController => ({
  busyAction: null,
  discardChanges: () => undefined,
  draftCount: 1,
  editorIsReadOnly: false,
  filter: "all",
  form: toUpdateForm(draftUpdate),
  formIsDirty: false,
  formIssue: null,
  interactionIsLocked: false,
  lineCount: 1,
  loadPreview: async () => undefined,
  loadState: "ready",
  message: "Update selected.",
  preview: null,
  previewIsAvailable: true,
  previewIsCurrent: false,
  publishIsAvailable: false,
  publishedCount: 0,
  publishUpdate: async () => undefined,
  refreshUpdates: () => undefined,
  saveDraft: async () => undefined,
  searchQuery: "",
  selectRow: () => undefined,
  selectedId: draftUpdate.id,
  selectedIsPublished: false,
  selectedUpdate: draftUpdate,
  setFilter: () => undefined,
  setSearchQuery: () => undefined,
  startNewUpdate: () => undefined,
  unpublishUpdate: async () => undefined,
  updateForm: () => undefined,
  updates: [draftUpdate],
  visibleUpdates: [draftUpdate],
  wordCount: 2,
  ...overrides
});

const getTag = (markup: string, pattern: RegExp): string => {
  const match = markup.match(pattern)?.[0];
  expect(match).toBeDefined();
  return match ?? "";
};

type Deferred<Value> = {
  promise: Promise<Value>;
  resolve: (value: Value) => void;
};

const createDeferred = <Value,>(): Deferred<Value> => {
  let resolvePromise: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: (value) => resolvePromise?.(value)
  };
};

const createJsonResponse = (body: unknown): Response => new Response(JSON.stringify(body), {
  headers: { "Content-Type": "application/json" },
  status: 200
});

const installWindowMock = (): ReturnType<typeof vi.fn> => {
  const storage = new Map<string, string>();
  const confirm = vi.fn(() => true);
  const localStorage = {
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size;
    },
    removeItem: (key: string) => storage.delete(key),
    setItem: (key: string, value: string) => storage.set(key, value)
  } satisfies Storage;

  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    confirm,
    history: { replaceState: vi.fn() },
    localStorage,
    location: { href: "https://maiks.yt/admin/updates" },
    removeEventListener: vi.fn()
  });

  return confirm;
};

const HookProbe = ({
  onRender
}: {
  onRender: (controller: PublicUpdateAdminWorkspaceController) => void;
}): React.ReactNode => {
  onRender(usePublicUpdateAdminWorkspace());
  return null;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("public update admin interaction lock", () => {
  it("disables form edits, new draft creation, and inventory selection while a request is active", () => {
    const markup = renderToStaticMarkup(
      <PublicUpdateAdminView
        controller={createController({
          busyAction: "Saving draft",
          interactionIsLocked: true
        })}
      />
    );

    expect(getTag(markup, /<button[^>]*>.*?New update.*?<\/button>/s)).toContain("disabled");
    expect(getTag(markup, /<button aria-current="true"[^>]*>/)).toContain("disabled");
    expect(getTag(markup, /<select[^>]*>/)).toContain("disabled");
    expect(getTag(markup, /<input[^>]*placeholder="Public update title"[^>]*>/)).toContain("disabled");
    expect(getTag(markup, /<input[^>]*placeholder="lowercase-update-slug"[^>]*>/)).toContain("disabled");
    expect(getTag(markup, /<textarea[^>]*placeholder="Short public summary"[^>]*>/)).toContain("disabled");
    expect(getTag(markup, /<textarea[^>]*placeholder="Write the public Markdown body\."[^>]*>/)).toContain("disabled");
    expect(getTag(markup, /<input[^>]*role="switch"[^>]*>/)).toContain("disabled");
  });

  it("keeps published records read-only without locking unrelated navigation when idle", () => {
    const publishedUpdate: PublicUpdateSource = {
      ...draftUpdate,
      status: "published",
      visibility: "public",
      publishedAt: "2026-08-28T12:30:00.000Z"
    };
    const markup = renderToStaticMarkup(
      <PublicUpdateAdminView
        controller={createController({
          draftCount: 0,
          editorIsReadOnly: true,
          form: toUpdateForm(publishedUpdate),
          publishedCount: 1,
          selectedIsPublished: true,
          selectedUpdate: publishedUpdate,
          updates: [publishedUpdate],
          visibleUpdates: [publishedUpdate]
        })}
      />
    );

    expect(getTag(markup, /<button[^>]*>.*?New update.*?<\/button>/s)).not.toContain("disabled");
    expect(getTag(markup, /<button aria-current="true"[^>]*>/)).not.toContain("disabled");
    expect(getTag(markup, /<input[^>]*placeholder="Public update title"[^>]*>/)).toContain("disabled");
  });

  it("guards real hook state from exposed interactions until a save response settles", async () => {
    const otherDraft: PublicUpdateSource = {
      ...draftUpdate,
      id: "other-draft",
      slug: "other-draft",
      title: "Other draft",
      updatedAt: "2026-08-28T11:55:00.000Z"
    };
    const savedResponseUpdate: PublicUpdateSource = {
      ...draftUpdate,
      title: "Prepared title",
      updatedAt: "2026-08-28T12:05:00.000Z"
    };
    const saveResponse = createDeferred<Response>();
    const confirm = installWindowMock();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);

      if (url.endsWith("/admin/updates") && (!init?.method || init.method === "GET")) {
        return Promise.resolve(createJsonResponse({
          ok: true,
          updates: [draftUpdate, otherDraft]
        }));
      }

      if (url.endsWith(`/admin/updates/${draftUpdate.id}`) && init?.method === "PATCH") {
        return saveResponse.promise;
      }

      return Promise.reject(new Error(`Unexpected request: ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    let controller: PublicUpdateAdminWorkspaceController | null = null;
    let renderer: ReactTestRenderer | null = null;
    const getController = (): PublicUpdateAdminWorkspaceController => {
      if (!controller) {
        throw new Error("Hook controller has not rendered.");
      }

      return controller;
    };
    await act(async () => {
      renderer = create(<HookProbe onRender={(nextController) => {
        controller = nextController;
      }} />);
    });

    expect(getController().loadState).toBe("ready");
    expect(getController().selectedId).toBe(draftUpdate.id);

    await act(async () => {
      getController().updateForm((current) => ({ ...current, title: "Prepared title" }));
    });
    expect(getController().form.title).toBe("Prepared title");

    let pendingSave: Promise<void> | null = null;
    await act(async () => {
      pendingSave = getController().saveDraft();
      await Promise.resolve();
    });

    expect(getController().busyAction).toBe("Saving draft");
    expect(getController().interactionIsLocked).toBe(true);

    const lockedController = getController();
    await act(async () => {
      lockedController.updateForm((current) => ({ ...current, title: "Blocked late edit" }));
      lockedController.selectRow(otherDraft);
      lockedController.startNewUpdate();
      lockedController.discardChanges();
    });

    expect(confirm).not.toHaveBeenCalled();
    expect(getController().selectedId).toBe(draftUpdate.id);
    expect(getController().form.title).toBe("Prepared title");

    await act(async () => {
      saveResponse.resolve(createJsonResponse({ ok: true, update: savedResponseUpdate }));
      await pendingSave;
    });

    expect(getController().busyAction).toBeNull();
    expect(getController().interactionIsLocked).toBe(false);
    expect(getController().selectedId).toBe(draftUpdate.id);
    expect(getController().form.title).toBe("Prepared title");
    expect(getController().updates.map((update) => update.id)).toEqual([
      draftUpdate.id,
      otherDraft.id
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      renderer?.unmount();
    });
  });
});
