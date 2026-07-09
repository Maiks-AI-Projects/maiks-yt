const getDevTestingSecret = () =>
  process.env.DEV_OWNER_TOKEN_MINT_SECRET
  ?? process.env.DEV_TEST_AUTH_MINT_SECRET
  ?? process.env.DEV_NOTIFICATION_POST_SECRET
  ?? null;

export const createDevOwnerTokenGetter = ({ config, http }) => {
  let devOwnerTokenPromise = null;

  const mintDevOwnerToken = async () => {
    const secret = getDevTestingSecret();

    if (!secret) {
      return {
        ok: true,
        skipped: true,
        reason: "No dev testing secret is available for owner-gated smoke checks."
      };
    }

    const response = await http.fetchWithTimeout(http.makeUrl(config.apiUrl, config.ownerTokenPath), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Dev-Testing-Secret": secret
      },
      body: JSON.stringify({
        label: "dev-smoke-provider-intake-health",
        path: "/admin/connections",
        ttlMinutes: 5
      })
    });
    const body = await response.text();

    let parsed;

    try {
      parsed = body ? JSON.parse(body) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok || parsed?.ok !== true || typeof parsed.token !== "string") {
      return {
        ok: false,
        reason: `Owner token mint returned HTTP ${response.status}.`
      };
    }

    return {
      ok: true,
      token: parsed.token
    };
  };

  return () => {
    devOwnerTokenPromise ??= mintDevOwnerToken();
    return devOwnerTokenPromise;
  };
};
