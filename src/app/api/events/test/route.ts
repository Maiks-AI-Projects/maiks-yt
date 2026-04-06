import { NextRequest, NextResponse } from 'next/server';
import { triggerEvent, EVENT_TYPES, EventType } from '@/lib/events';

/**
 * Test route to manually trigger SSE events for debugging.
 * 
 * POST /api/events/test
 * {
 *   "channel": "global",
 *   "type": "donation",
 *   "data": { "amount": 10.00, "message": "Test Donation!" }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { channel = 'global', type = EVENT_TYPES.SYSTEM, data = { message: 'Test message' } } = body;

    triggerEvent(channel, type as EventType, data);

    return NextResponse.json({ 
      success: true, 
      message: `Triggered event ${type} on channel ${channel}` 
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}
