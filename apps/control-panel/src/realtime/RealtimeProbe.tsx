import { useState, type ReactNode } from "react";

type ProbeStatus = "idle" | "connecting" | "open" | "failed" | "closed";

type RealtimeProbeProps = {
  apiBaseUrl: string;
};

const maxProbeMessages = 6;

const createWebSocketUrl = (baseUrl: string, path: string): string => {
  const url = new URL(path, baseUrl);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  return url.toString();
};

const appendProbeMessage = (messages: string[], message: string): string[] => [
  message,
  ...messages
].slice(0, maxProbeMessages);

export const RealtimeProbe = ({ apiBaseUrl }: RealtimeProbeProps): ReactNode => {
  const [webSocketStatus, setWebSocketStatus] = useState<ProbeStatus>("idle");
  const [sseStatus, setSseStatus] = useState<ProbeStatus>("idle");
  const [webSocketMessages, setWebSocketMessages] = useState<string[]>([]);
  const [sseMessages, setSseMessages] = useState<string[]>([]);

  const testWebSocket = (): void => {
    setWebSocketStatus("connecting");
    setWebSocketMessages([]);

    const webSocket = new WebSocket(createWebSocketUrl(apiBaseUrl, "/realtime/spike/ws"));
    const timeout = window.setTimeout(() => {
      setWebSocketStatus("failed");
      webSocket.close();
    }, 12_000);

    webSocket.addEventListener("open", () => {
      setWebSocketStatus("open");
      webSocket.send("control-panel-probe");
    });
    webSocket.addEventListener("message", (event) => {
      window.clearTimeout(timeout);
      setWebSocketMessages((messages) => appendProbeMessage(messages, String(event.data)));
      webSocket.close();
    });
    webSocket.addEventListener("close", () => {
      window.clearTimeout(timeout);
      setWebSocketStatus((status) => status === "failed" ? status : "closed");
    });
    webSocket.addEventListener("error", () => {
      window.clearTimeout(timeout);
      setWebSocketStatus("failed");
      webSocket.close();
    });
  };

  const testSse = (): void => {
    setSseStatus("connecting");
    setSseMessages([]);

    const eventSource = new EventSource(new URL("/realtime/spike/sse", apiBaseUrl));
    const timeout = window.setTimeout(() => {
      setSseStatus("failed");
      eventSource.close();
    }, 12_000);

    eventSource.addEventListener("open", () => {
      setSseStatus("open");
    });
    eventSource.addEventListener("heartbeat", (event) => {
      window.clearTimeout(timeout);
      setSseMessages((messages) => appendProbeMessage(messages, event.data));
      eventSource.close();
      setSseStatus("closed");
    });
    eventSource.addEventListener("error", () => {
      window.clearTimeout(timeout);
      setSseStatus("failed");
      eventSource.close();
    });
  };

  return (
    <section className="realtime-probe">
      <h2>Realtime Probe</h2>
      <div className="probe-actions">
        <button type="button" onClick={testWebSocket}>Test WebSocket</button>
        <button type="button" onClick={testSse}>Test SSE</button>
      </div>
      <div className="probe-grid">
        <article>
          <strong>WebSocket</strong>
          <span className={`probe-status ${webSocketStatus}`}>{webSocketStatus}</span>
          <ol>
            {webSocketMessages.map((message, index) => (
              <li key={`ws-${index}`}>{message}</li>
            ))}
          </ol>
        </article>
        <article>
          <strong>SSE</strong>
          <span className={`probe-status ${sseStatus}`}>{sseStatus}</span>
          <ol>
            {sseMessages.map((message, index) => (
              <li key={`sse-${index}`}>{message}</li>
            ))}
          </ol>
        </article>
      </div>
    </section>
  );
};
