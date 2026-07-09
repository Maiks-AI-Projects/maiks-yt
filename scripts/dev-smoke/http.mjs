const injectionMarkers = [
  "bsc-testnet-rpc",
  "publicnode",
  "stop watching us",
  "worker-winter-bird-f0bf"
];

export const createHttpClient = (config) => {
  const makeUrl = (baseUrl, path = "/") => new URL(path, baseUrl).toString();

  const fetchWithTimeout = async (url, options = {}) => fetch(url, {
    ...options,
    signal: AbortSignal.timeout(config.timeoutMs)
  });

  const readJson = async (url, options = {}) => {
    const response = await fetchWithTimeout(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...options.headers
      }
    });
    const body = await response.text();

    let parsed;

    try {
      parsed = body ? JSON.parse(body) : null;
    } catch {
      parsed = null;
    }

    return {
      body,
      json: parsed,
      ok: response.ok,
      status: response.status,
      url
    };
  };

  const readText = async (url) => {
    const response = await fetchWithTimeout(url, {
      headers: {
        Accept: "text/html,application/javascript,text/plain,*/*"
      }
    });

    return {
      body: await response.text(),
      ok: response.ok,
      status: response.status,
      url
    };
  };

  const findInjectionMarkers = (body) =>
    injectionMarkers.filter((marker) => body.toLowerCase().includes(marker.toLowerCase()));

  return {
    fetchWithTimeout,
    findInjectionMarkers,
    makeUrl,
    readJson,
    readText
  };
};
