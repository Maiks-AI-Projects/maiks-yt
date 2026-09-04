import type { StreamerChatMessage } from "@maiks-yt/events";
import { useEffect } from "react";
import testRenderer from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChatAttention } from "./useChatAttention.js";

type ChatAttention = ReturnType<typeof useChatAttention>;

type TestRendererInstance = {
  toJSON(): unknown;
  unmount(): void;
};

type TestRendererModule = {
  act(callback: () => Promise<void> | void): Promise<void>;
  create(element: React.ReactElement): TestRendererInstance;
};

const { act, create } = testRenderer as TestRendererModule;
const storedValues = new Map<string, string>();
let mountedProbe: TestRendererInstance | null = null;
let attention: ChatAttention | null = null;

const message: StreamerChatMessage = {
  id: "message-1",
  authorKind: "human",
  authorName: "Test chatter",
  createdAt: "2026-09-04T00:00:00.000Z",
  message: "Hello from chat.",
  source: "twitch",
  visibleOnOverlayByDefault: true
};

const AttentionProbe = (): React.ReactNode => {
  const currentAttention = useChatAttention(true);

  useEffect(() => {
    attention = currentAttention;
  }, [currentAttention]);

  return currentAttention.controls;
};

const renderText = (): string => JSON.stringify(mountedProbe?.toJSON());

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  storedValues.clear();
  attention = null;

  vi.stubGlobal("document", { title: "Maiks.yt Streamer Chat" });
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("SpeechSynthesisUtterance", class {
    public rate = 1;
    public volume = 1;

    public constructor(public readonly text: string) {}
  });
  vi.stubGlobal("window", {
    focus: vi.fn(),
    localStorage: {
      getItem: vi.fn((key: string) => storedValues.get(key) ?? null),
      removeItem: vi.fn((key: string) => storedValues.delete(key)),
      setItem: vi.fn((key: string, value: string) => storedValues.set(key, value))
    },
    location: { pathname: "/streamer-chat" },
    speechSynthesis: { speak: vi.fn() }
  });
});

afterEach(async () => {
  if (mountedProbe) {
    await act(async () => mountedProbe?.unmount());
  }
  mountedProbe = null;
  attention = null;
  vi.unstubAllGlobals();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("useChatAttention", () => {
  it("consumes a message when speech accepts it and does not replay it after reconnect or remount", async () => {
    await act(async () => {
      mountedProbe = create(<AttentionProbe />);
    });
    await act(async () => {
      attention?.baselineMessages([]);
      attention?.notifyMessage(message);
    });

    expect(window.speechSynthesis.speak).toHaveBeenCalledOnce();
    expect(renderText()).toContain("Attention ready");
    expect(renderText()).not.toContain("1 unread");

    await act(async () => attention?.notifyMessage(message));
    expect(window.speechSynthesis.speak).toHaveBeenCalledOnce();

    await act(async () => mountedProbe?.unmount());
    mountedProbe = null;
    attention = null;
    await act(async () => {
      mountedProbe = create(<AttentionProbe />);
    });
    await act(async () => {
      attention?.baselineMessages([message]);
      attention?.notifyMessage(message);
    });

    expect(window.speechSynthesis.speak).toHaveBeenCalledOnce();
    expect(renderText()).toContain("Attention ready");
  });

  it("keeps a message unread when speech cannot accept it", async () => {
    vi.mocked(window.speechSynthesis.speak).mockImplementation(() => {
      throw new Error("speech unavailable");
    });

    await act(async () => {
      mountedProbe = create(<AttentionProbe />);
    });
    await act(async () => {
      attention?.baselineMessages([]);
      attention?.notifyMessage(message);
    });

    expect(renderText()).toContain("1 unread");

    await act(async () => attention?.reconcileMessages([]));
    expect(renderText()).toContain("Attention ready");
    expect(renderText()).not.toContain("Read latest");
  });
});
