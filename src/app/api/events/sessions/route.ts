import { NextResponse } from 'next/server';
import { activeSessions } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sessions = Array.from(activeSessions.values());
  return NextResponse.json(sessions);
}
