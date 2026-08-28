import { describe, expect, it } from "vitest";

import { parseAccountSession } from "./account-session.service";

describe("account session response parser", () => {
  it("accepts and reconstructs the exact minimal signed-in projection", () => {
    const response = {
      ok: true,
      signedIn: true,
      currentUser: {
        name: "Michael",
        email: "owner@example.test",
        imageUrl: "https://avatar.example.test/michael.png"
      }
    };

    expect(parseAccountSession(response)).toEqual(response);
  });

  it("keeps the signed-out null response signed out", () => {
    expect(parseAccountSession(null)).toBeNull();
  });

  it.each([
    undefined,
    false,
    [],
    {},
    {
      user: {
        id: "raw-auth-user-id",
        name: "Legacy User",
        email: "legacy@example.test",
        image: "https://avatar.example.test/legacy.png"
      },
      session: {
        id: "raw-session-id",
        token: "raw-session-token"
      }
    },
    {
      ok: true,
      signedIn: true,
      currentUser: {
        name: "Michael",
        email: "owner@example.test"
      }
    },
    {
      ok: true,
      signedIn: true,
      currentUser: {
        name: "Michael",
        email: "owner@example.test",
        imageUrl: 42
      }
    },
    {
      ok: true,
      signedIn: true,
      currentUser: {
        name: "Michael",
        email: "owner@example.test",
        imageUrl: null
      },
      session: {
        token: "raw-session-token"
      }
    },
    {
      ok: true,
      signedIn: true,
      currentUser: {
        name: "Michael",
        email: "owner@example.test",
        imageUrl: null,
        id: "raw-auth-user-id"
      }
    }
  ])("denies malformed or raw session payload %# without throwing", (response) => {
    expect(() => parseAccountSession(response)).not.toThrow();
    expect(parseAccountSession(response)).toBeNull();
  });
});
