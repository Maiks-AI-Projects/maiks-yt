import { useEffect } from "react";
import testRenderer from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getControlAccessRetryDelay,
  validateControlPanelAccess,
  type ControlPanelAuthState
} from "./control-access.service.js";
import { useControlAccess, type ControlAccessTransientIssue } from "./control-access.state.js";

vi.mock("./control-access.service.js", async () => {
  const actual = await vi.importActual<typeof import("./control-access.service.js")>("./control-access.service.js");

  return {
    ...actual,
    getControlAccessRetryDelay: vi.fn(() => 2_000),
    validateControlPanelAccess: vi.fn()
  };
});

type TestRendererInstance = {
  unmount(): void;
};

type TestRendererModule = {
  act(callback: () => Promise<void> | void): Promise<void>;
  create(element: React.ReactElement): TestRendererInstance;
};

type ControlAccessSnapshot = {
  readonly authState: ControlPanelAuthState;
  readonly transientIssue: ControlAccessTransientIssue | null;
};

const { act, create } = testRenderer as TestRendererModule;
const validateControlPanelAccessMock = vi.mocked(validateControlPanelAccess);
const getControlAccessRetryDelayMock = vi.mocked(getControlAccessRetryDelay);

const listeners = {
  document: new Map<string, Set<() => void>>(),
  window: new Map<string, Set<() => void>>()
};

let mountedProbe: TestRendererInstance | null = null;
let timeoutCallbacks: Array<() => void> = [];
let storedValues: Map<string, string>;

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const deferredAuthState = (): {
  readonly promise: Promise<ControlPanelAuthState>;
  readonly resolve: (authState: ControlPanelAuthState) => void;
} => {
  let resolveState!: (authState: ControlPanelAuthState) => void;
  const promise = new Promise<ControlPanelAuthState>((resolve) => {
    resolveState = resolve;
  });

  return {
    promise,
    resolve: resolveState
  };
};

const collectSnapshotText = (snapshots: readonly ControlAccessSnapshot[]): string =>
  JSON.stringify(snapshots);

const addListener = (
  targetListeners: Map<string, Set<() => void>>,
  eventName: string,
  listener: EventListenerOrEventListenerObject
): void => {
  const callback = typeof listener === "function"
    ? listener as () => void
    : () => listener.handleEvent(new Event(eventName));

  const eventListeners = targetListeners.get(eventName) ?? new Set<() => void>();
  eventListeners.add(callback);
  targetListeners.set(eventName, eventListeners);
};

const removeListener = (
  targetListeners: Map<string, Set<() => void>>,
  eventName: string,
  listener: EventListenerOrEventListenerObject
): void => {
  const eventListeners = targetListeners.get(eventName);

  if (!eventListeners) {
    return;
  }

  if (typeof listener === "function") {
    eventListeners.delete(listener as () => void);
  }
};

const dispatchWindowEvent = (eventName: string): void => {
  for (const listener of listeners.window.get(eventName) ?? []) {
    listener();
  }
};

const AccessProbe = ({
  onConfirmedLoginRequired,
  onSnapshot
}: {
  readonly onConfirmedLoginRequired?: () => void;
  readonly onSnapshot: (snapshot: ControlAccessSnapshot) => void;
}): null => {
  const access = useControlAccess("https://api.example.test", onConfirmedLoginRequired);

  useEffect(() => {
    onSnapshot({
      authState: access.authState,
      transientIssue: access.transientIssue
    });
  }, [access.authState, access.transientIssue, onSnapshot]);

  return null;
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  getControlAccessRetryDelayMock.mockReturnValue(2_000);
  listeners.document.clear();
  listeners.window.clear();
  timeoutCallbacks = [];
  storedValues = new Map<string, string>();

  vi.stubGlobal("document", {
    visibilityState: "visible",
    addEventListener: vi.fn((eventName: string, listener: EventListenerOrEventListenerObject) => {
      addListener(listeners.document, eventName, listener);
    }),
    removeEventListener: vi.fn((eventName: string, listener: EventListenerOrEventListenerObject) => {
      removeListener(listeners.document, eventName, listener);
    })
  });
  vi.stubGlobal("window", {
    addEventListener: vi.fn((eventName: string, listener: EventListenerOrEventListenerObject) => {
      addListener(listeners.window, eventName, listener);
    }),
    removeEventListener: vi.fn((eventName: string, listener: EventListenerOrEventListenerObject) => {
      removeListener(listeners.window, eventName, listener);
    }),
    clearTimeout: vi.fn(),
    localStorage: {
      getItem: vi.fn((key: string) => storedValues.get(key) ?? null),
      removeItem: vi.fn((key: string) => {
        storedValues.delete(key);
      }),
      setItem: vi.fn((key: string, value: string) => {
        storedValues.set(key, value);
      })
    },
    setTimeout: vi.fn((callback: () => void) => {
      timeoutCallbacks.push(callback);
      return timeoutCallbacks.length;
    })
  });
});

afterEach(async () => {
  if (mountedProbe) {
    await act(async () => {
      mountedProbe?.unmount();
    });
  }

  mountedProbe = null;
  vi.unstubAllGlobals();
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("control access mounted recovery", () => {
  it("coalesces overlapping focus visibility and online access checks", async () => {
    const snapshots: ControlAccessSnapshot[] = [];
    const firstAccessCheck = deferredAuthState();

    validateControlPanelAccessMock.mockReturnValueOnce(firstAccessCheck.promise);

    await act(async () => {
      mountedProbe = create(<AccessProbe onSnapshot={(snapshot) => snapshots.push(snapshot)} />);
      await flushPromises();
    });

    await act(async () => {
      dispatchWindowEvent("focus");
      dispatchWindowEvent("online");
      for (const listener of listeners.document.get("visibilitychange") ?? []) {
        listener();
      }
      await flushPromises();
    });

    expect(validateControlPanelAccessMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstAccessCheck.resolve({
        status: "allowed",
        displayName: "Michael"
      });
      await flushPromises();
    });

    expect(snapshots.at(-1)?.authState).toEqual({
      status: "allowed",
      displayName: "Michael"
    });
  });

  it("keeps the last allowed operational shell during transient refresh failure and retries in place", async () => {
    const snapshots: ControlAccessSnapshot[] = [];

    validateControlPanelAccessMock
      .mockResolvedValueOnce({
        status: "allowed",
        displayName: "Michael"
      })
      .mockResolvedValueOnce({
        status: "blocked",
        kind: "unavailable",
        message: "Session refresh failed with 429.",
        preserveOperationalShell: true
      });

    await act(async () => {
      mountedProbe = create(<AccessProbe onSnapshot={(snapshot) => snapshots.push(snapshot)} />);
      await flushPromises();
    });

    expect(snapshots.at(-1)?.authState).toEqual({
      status: "allowed",
      displayName: "Michael"
    });

    await act(async () => {
      dispatchWindowEvent("focus");
      await flushPromises();
    });

    expect(snapshots.at(-1)?.authState).toEqual({
      status: "allowed",
      displayName: "Michael"
    });
    expect(snapshots.at(-1)?.transientIssue).toEqual({
      message: "Session refresh failed with 429.",
      retrying: true
    });
    expect(getControlAccessRetryDelayMock).toHaveBeenCalledWith(0);
    expect(timeoutCallbacks).toHaveLength(2);
  });

  it("does not write session-derived identity into localStorage after a verified access check", async () => {
    const snapshots: ControlAccessSnapshot[] = [];
    validateControlPanelAccessMock.mockResolvedValueOnce({
      status: "allowed",
      displayName: "Michael"
    });

    await act(async () => {
      mountedProbe = create(<AccessProbe onSnapshot={(snapshot) => snapshots.push(snapshot)} />);
      await flushPromises();
    });

    expect(snapshots.at(-1)?.authState).toEqual({
      status: "allowed",
      displayName: "Michael"
    });
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("does not resurrect a stale persisted identity after reload or account change", async () => {
    const snapshots: ControlAccessSnapshot[] = [];
    storedValues.set("maiks.yt.control.lastAllowedSessionShell", JSON.stringify({
      displayName: "Previous account"
    }));
    validateControlPanelAccessMock
      .mockResolvedValueOnce({
        status: "blocked",
        kind: "unavailable",
        message: "Session refresh failed with 429.",
        preserveOperationalShell: true
      })
      .mockResolvedValueOnce({
        status: "allowed",
        displayName: "New account"
      });

    await act(async () => {
      mountedProbe = create(<AccessProbe onSnapshot={(snapshot) => snapshots.push(snapshot)} />);
      await flushPromises();
    });

    expect(snapshots.at(-1)).toEqual({
      authState: {
        status: "reconnecting",
        message: "Session refresh failed with 429."
      },
      transientIssue: null
    });
    expect(collectSnapshotText(snapshots)).not.toContain("Previous account");
    expect(storedValues.has("maiks.yt.control.lastAllowedSessionShell")).toBe(false);

    await act(async () => {
      timeoutCallbacks.at(-1)?.();
      await flushPromises();
    });

    expect(snapshots.at(-1)).toEqual({
      authState: {
        status: "allowed",
        displayName: "New account"
      },
      transientIssue: null
    });
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it("renders a neutral retry state for an initial transient failure before any verified in-memory shell", async () => {
    const snapshots: ControlAccessSnapshot[] = [];
    const onConfirmedLoginRequired = vi.fn();

    validateControlPanelAccessMock.mockResolvedValueOnce({
      status: "blocked",
      kind: "unavailable",
      message: "Session refresh failed with 429.",
      preserveOperationalShell: true
    });

    await act(async () => {
      mountedProbe = create(
        <AccessProbe
          onConfirmedLoginRequired={onConfirmedLoginRequired}
          onSnapshot={(snapshot) => snapshots.push(snapshot)}
        />
      );
      await flushPromises();
    });

    expect(snapshots.at(-1)).toEqual({
      authState: {
        status: "reconnecting",
        message: "Session refresh failed with 429."
      },
      transientIssue: null
    });
    expect(onConfirmedLoginRequired).not.toHaveBeenCalled();
  });

  it("fails closed and clears the preserved shell on genuine sign-in loss", async () => {
    const snapshots: ControlAccessSnapshot[] = [];
    const onConfirmedLoginRequired = vi.fn();

    validateControlPanelAccessMock
      .mockResolvedValueOnce({
        status: "allowed",
        displayName: "Michael"
      })
      .mockResolvedValueOnce({
        status: "blocked",
        kind: "login-required",
        message: "Your sign-in needs to be renewed."
      });

    await act(async () => {
      mountedProbe = create(
        <AccessProbe
          onConfirmedLoginRequired={onConfirmedLoginRequired}
          onSnapshot={(snapshot) => snapshots.push(snapshot)}
        />
      );
      await flushPromises();
    });

    expect(snapshots.at(-1)?.authState.status).toBe("allowed");

    await act(async () => {
      dispatchWindowEvent("online");
      await flushPromises();
    });

    expect(snapshots.at(-1)).toEqual({
      authState: {
        status: "blocked",
        kind: "login-required",
        message: "Your sign-in needs to be renewed."
      },
      transientIssue: null
    });
    expect(storedValues.has("maiks.yt.control.lastAllowedSessionShell")).toBe(false);
    expect(onConfirmedLoginRequired).toHaveBeenCalledTimes(1);
  });

  it("fails closed and clears the preserved shell on role loss", async () => {
    const snapshots: ControlAccessSnapshot[] = [];

    validateControlPanelAccessMock
      .mockResolvedValueOnce({
        status: "allowed",
        displayName: "Michael"
      })
      .mockResolvedValueOnce({
        status: "blocked",
        kind: "token-denied",
        message: "Access token was not accepted."
      });

    await act(async () => {
      mountedProbe = create(<AccessProbe onSnapshot={(snapshot) => snapshots.push(snapshot)} />);
      await flushPromises();
    });

    expect(snapshots.at(-1)?.authState.status).toBe("allowed");

    await act(async () => {
      dispatchWindowEvent("online");
      await flushPromises();
    });

    expect(snapshots.at(-1)).toEqual({
      authState: {
        status: "blocked",
        kind: "token-denied",
        message: "Access token was not accepted."
      },
      transientIssue: null
    });
    expect(storedValues.has("maiks.yt.control.lastAllowedSessionShell")).toBe(false);
  });
});
