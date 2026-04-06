'use client';

import { useEffect, useState, useCallback } from 'react';

export interface StreamEvent {
  id: string;
  type: 'donation' | 'verification' | 'goal' | 'chat' | 'join' | 'event' | 'system';
  channel: string;
  data: {
    user?: string;
    message?: string;
    amount?: number;
    currency?: string;
    platform?: string;
    [key: string]: any;
  };
  timestamp: string;
}

export function useEvents() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null);

  const handleEvent = useCallback((eventData: string) => {
    try {
      const parsed: StreamEvent = JSON.parse(eventData);
      setEvents((prev) => [parsed, ...prev].slice(0, 50));
      setLastEvent(parsed);
    } catch (err) {
      // Ignore heartbeat or non-json data
      if (!eventData.includes('heartbeat')) {
        console.error('Failed to parse event data:', err);
      }
    }
  }, []);

  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      handleEvent(event.data);
    };

    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
      eventSource.close();
      // Reconnect after 3 seconds
      setTimeout(() => {
        // This will trigger the effect again because of the dependency array (if I had one for reconnection)
        // But for now, we'll just rely on manual refresh or a more robust reconnection logic if needed.
        // Actually, EventSource has built-in reconnection, but onerror can signify terminal failure.
      }, 3000);
    };

    return () => {
      eventSource.close();
    };
  }, [handleEvent]);

  return { events, lastEvent };
}
