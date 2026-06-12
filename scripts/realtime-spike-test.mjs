import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(repoRoot, "reports", "realtime-spike");
const apiBaseUrl = process.env.REALTIME_SPIKE_API_BASE_URL ?? "https://api-dev.maiks.yt";
const durationMs = Number.parseInt(process.env.REALTIME_SPIKE_DURATION_MS ?? String(30 * 60 * 1_000), 10);
const startedAt = new Date();
const runId = startedAt.toISOString().replaceAll(":", "-").replaceAll(".", "-");

mkdirSync(outputDirectory, { recursive: true });

const websocketLogPath = join(outputDirectory, `${runId}-websocket.jsonl`);
const sseLogPath = join(outputDirectory, `${runId}-sse.jsonl`);
const websocketLog = createWriteStream(websocketLogPath, { flags: "a" });
const sseLog = createWriteStream(sseLogPath, { flags: "a" });

const writeLog = (stream, record) => {
  stream.write(`${JSON.stringify({ clientReceivedAt: new Date().toISOString(), ...record })}\n`);
};

const createWebSocketUrl = (baseUrl, path) => {
  const url = new URL(path, baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

const parseEventData = (data) => {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

const createSummary = (transport) => ({
  transport,
  opened: false,
  closed: false,
  errors: 0,
  messages: 0,
  firstSequence: null,
  lastSequence: null,
  missingSequences: []
});

const updateSummary = (summary, event) => {
  const sequence = event?.payload?.sequence;

  summary.messages += 1;

  if (typeof sequence !== "number") {
    return;
  }

  if (summary.firstSequence === null) {
    summary.firstSequence = sequence;
  }

  if (summary.lastSequence !== null && sequence > summary.lastSequence + 1) {
    for (let missing = summary.lastSequence + 1; missing < sequence; missing += 1) {
      summary.missingSequences.push(missing);
    }
  }

  summary.lastSequence = sequence;
};

const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

const runWebSocketProbe = async (summary) => {
  if (typeof WebSocket === "undefined") {
    summary.errors += 1;
    writeLog(websocketLog, {
      type: "client.error",
      message: "Global WebSocket is unavailable. Use Node 22+ or newer."
    });
    return;
  }

  await new Promise((resolve) => {
    const socket = new WebSocket(createWebSocketUrl(apiBaseUrl, "/realtime/spike/ws"));
    const closeTimer = setTimeout(() => {
      socket.close(1000, "realtime spike complete");
    }, durationMs);

    socket.addEventListener("open", () => {
      summary.opened = true;
      writeLog(websocketLog, { type: "client.open" });
      socket.send("realtime-spike-test");
    });
    socket.addEventListener("message", (event) => {
      const parsed = parseEventData(event.data);
      updateSummary(summary, parsed);
      writeLog(websocketLog, { type: "server.event", event: parsed });
    });
    socket.addEventListener("error", (event) => {
      summary.errors += 1;
      writeLog(websocketLog, {
        type: "client.error",
        message: event.message ?? "WebSocket error"
      });
    });
    socket.addEventListener("close", (event) => {
      clearTimeout(closeTimer);
      summary.closed = true;
      writeLog(websocketLog, {
        type: "client.close",
        code: event.code,
        reason: event.reason
      });
      resolve();
    });
  });
};

const runSseProbe = async (summary) => {
  const controller = new AbortController();
  const closeTimer = setTimeout(() => {
    controller.abort();
  }, durationMs);

  try {
    const response = await fetch(new URL("/realtime/spike/sse", apiBaseUrl), {
      headers: {
        accept: "text/event-stream"
      },
      signal: controller.signal
    });

    summary.opened = response.ok;
    writeLog(sseLog, {
      type: "client.open",
      contentType: response.headers.get("content-type"),
      status: response.status
    });

    if (!response.ok || !response.body) {
      summary.errors += 1;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));

        if (!dataLine) {
          continue;
        }

        const parsed = parseEventData(dataLine.slice("data: ".length));
        updateSummary(summary, parsed);
        writeLog(sseLog, { type: "server.event", event: parsed });
      }
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      summary.errors += 1;
      writeLog(sseLog, {
        type: "client.error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  } finally {
    clearTimeout(closeTimer);
    summary.closed = true;
    writeLog(sseLog, { type: "client.close" });
  }
};

const websocketSummary = createSummary("websocket");
const sseSummary = createSummary("sse");

console.log(`Running realtime spike for ${Math.round(durationMs / 1_000)} seconds against ${apiBaseUrl}`);
console.log(`WebSocket log: ${websocketLogPath}`);
console.log(`SSE log: ${sseLogPath}`);

await Promise.all([
  runWebSocketProbe(websocketSummary),
  runSseProbe(sseSummary)
]);

await wait(100);
websocketLog.end();
sseLog.end();

console.log(JSON.stringify({
  apiBaseUrl,
  durationMs,
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  summaries: [
    websocketSummary,
    sseSummary
  ]
}, null, 2));
