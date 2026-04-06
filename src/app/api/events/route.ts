import { NextRequest } from 'next/server';
import { eventEmitter, AppEvent, activeSessions, SessionInfo } from '@/lib/events';

/**
 * SSE Route to support real-time streaming of events.
 */

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requestedChannel = searchParams.get('channel') || 'global';
  const sessionId = crypto.randomUUID();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Register session
      const sessionInfo: SessionInfo = {
        id: sessionId,
        channel: requestedChannel,
        connectedAt: new Date().toISOString(),
      };
      activeSessions.set(sessionId, sessionInfo);

      // Broadcast session join event
      eventEmitter.emit('app-event', {
        id: crypto.randomUUID(),
        type: 'system',
        channel: 'admin',
        data: { action: 'session_joined', session: sessionInfo },
        timestamp: new Date().toISOString()
      });

      const onEvent = (event: AppEvent) => {
        if (requestedChannel === 'global' || event.channel === requestedChannel) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch (e) {
            console.error('[SSE] Error enqueuing event:', e);
            eventEmitter.off('app-event', onEvent);
          }
        }
      };

      eventEmitter.on('app-event', onEvent);

      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (e) {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      req.signal.onabort = () => {
        console.log(`[SSE] Client disconnected: ${sessionId} (channel: ${requestedChannel})`);
        clearInterval(heartbeatInterval);
        eventEmitter.off('app-event', onEvent);
        activeSessions.delete(sessionId);
        
        // Broadcast session leave event
        eventEmitter.emit('app-event', {
          id: crypto.randomUUID(),
          type: 'system',
          channel: 'admin',
          data: { action: 'session_left', sessionId },
          timestamp: new Date().toISOString()
        });

        try {
          controller.close();
        } catch (e) {
        }
      };

      console.log(`[SSE] New client connected: ${sessionId} (channel: ${requestedChannel})`);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
