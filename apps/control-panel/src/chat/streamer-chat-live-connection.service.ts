import {
  getStreamerChatReconnectDelayMs,
  shouldReconnectStreamerChat
} from "./streamer-chat-viewer.service.js";

type StreamerChatSocket = Pick<WebSocket, "close" | "onclose" | "onerror" | "onmessage" | "onopen">;

type StreamerChatLiveConnectionOptions = {
  createSocket?: (url: string) => StreamerChatSocket;
  onAccessDenied: () => void;
  onConnected: () => void;
  onConnecting: (isReconnect: boolean) => void;
  onDisconnected: (retryDelayMs: number) => void;
  onError: () => void;
  onMessage: (data: unknown) => void;
  scheduleReconnect?: (callback: () => void, delayMs: number) => number;
  cancelReconnect?: (timerId: number) => void;
  url: string;
};

export const connectStreamerChatLiveFeed = ({
  cancelReconnect = (timerId) => window.clearTimeout(timerId),
  createSocket = (url) => new WebSocket(url),
  onAccessDenied,
  onConnected,
  onConnecting,
  onDisconnected,
  onError,
  onMessage,
  scheduleReconnect = (callback, delayMs) => window.setTimeout(callback, delayMs),
  url
}: StreamerChatLiveConnectionOptions): (() => void) => {
  let activeSocket: StreamerChatSocket | null = null;
  let disposed = false;
  let reconnectAttempt = 0;
  let reconnectTimer: number | null = null;

  const connect = (): void => {
    if (disposed) {
      return;
    }

    onConnecting(reconnectAttempt > 0);
    const socket = createSocket(url);
    activeSocket = socket;

    socket.onopen = () => {
      if (disposed || socket !== activeSocket) {
        return;
      }

      reconnectAttempt = 0;
      onConnected();
    };
    socket.onmessage = (event) => {
      if (!disposed && socket === activeSocket) {
        onMessage(event.data);
      }
    };
    socket.onerror = () => {
      if (!disposed && socket === activeSocket) {
        onError();
      }
    };
    socket.onclose = (event) => {
      if (disposed || socket !== activeSocket) {
        return;
      }

      activeSocket = null;
      const accessDenied = event.code === 1008;
      if (accessDenied) {
        onAccessDenied();
      }

      if (!shouldReconnectStreamerChat(event.code)) {
        return;
      }
      const retryDelayMs = getStreamerChatReconnectDelayMs(reconnectAttempt);
      reconnectAttempt += 1;
      if (!accessDenied) {
        onDisconnected(retryDelayMs);
      }
      reconnectTimer = scheduleReconnect(connect, retryDelayMs);
    };
  };

  connect();

  return () => {
    disposed = true;
    if (reconnectTimer !== null) {
      cancelReconnect(reconnectTimer);
    }
    activeSocket?.close();
    activeSocket = null;
  };
};
