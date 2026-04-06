import { NextResponse } from 'next/server';
import { auth } from '@workos-inc/authkit-nextjs';
import { prisma } from '@/lib/prisma';
import { triggerEvent, EVENT_TYPES } from '@/lib/events';

/**
 * Handle POST requests to link a game account.
 * Protected: Require a WorkOS session.
 * Parameters: platform (e.g., 'minecraft'), externalId (UUID), characterName.
 */
export async function POST(req: Request) {
  try {
    const { user } = await auth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { platform, externalId, characterName, channel = 'global' } = body;

    // Validation
    if (!platform || typeof platform !== 'string') {
      return NextResponse.json({ error: 'platform is required and must be a string' }, { status: 400 });
    }
    if (!externalId || typeof externalId !== 'string') {
      return NextResponse.json({ error: 'externalId is required and must be a string (UUID)' }, { status: 400 });
    }
    if (!characterName || typeof characterName !== 'string') {
      return NextResponse.json({ error: 'characterName is required and must be a string' }, { status: 400 });
    }

    // UUID validation (Simple regex for externalId)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(externalId)) {
      return NextResponse.json({ error: 'externalId must be a valid UUID' }, { status: 400 });
    }

    // Find the user in Prisma
    let dbUser = await prisma.user.findUnique({
      where: { workosId: user.id },
      include: { profile: true }
    });

    if (!dbUser) {
      // Fallback: If user is not yet in database (e.g., first login, webhook delay)
      dbUser = await prisma.user.create({
        data: {
          workosId: user.id,
          email: user.email,
          profile: {
            create: {
              username: `${user.email.split('@')[0]}_${Math.random().toString(36).substring(2, 6)}`,
            }
          }
        },
        include: { profile: true }
      });
    } else if (!dbUser.profile) {
      // Ensure profile exists if it was missing for some reason
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          profile: {
            create: {
              username: `${user.email.split('@')[0]}_${Math.random().toString(36).substring(2, 6)}`,
            }
          }
        },
        include: { profile: true }
      });
    }

    // Check if this platform and externalId is already linked
    const existingLink = await prisma.gameVerification.findFirst({
      where: {
        userId: dbUser.id,
        platform,
        externalId,
      },
    });

    if (existingLink) {
        return NextResponse.json({
            message: 'Game account is already linked.',
            gameVerification: existingLink,
        });
    }

    // Link the game account in GameVerification model
    const gameVerification = await prisma.gameVerification.create({
      data: {
        userId: dbUser.id,
        platform,
        externalId,
        verified: false,
        badges: { characterName }, // Store characterName in badges
      },
    });

    // Update Profile gameAccounts JSON
    // We can safely assume dbUser.profile exists now
    const gameAccounts = (dbUser.profile?.gameAccounts as any) || {};
    gameAccounts[platform] = { 
      externalId, 
      characterName, 
      verified: false,
      verificationId: gameVerification.id 
    };
    
    await prisma.profile.update({
      where: { id: dbUser.profile?.id },
      data: { gameAccounts },
    });

    // Trigger Real-time event for verification pending
    triggerEvent(channel, EVENT_TYPES.VERIFICATION, {
      userId: dbUser.id,
      platform,
      characterName,
      status: 'pending_verification',
    });

    return NextResponse.json({
      success: true,
      message: 'Game account linked successfully. Verification pending.',
      data: {
        gameVerification,
      },
    });
  } catch (error: any) {
    console.error('Game verification route error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
