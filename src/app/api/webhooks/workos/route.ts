import { NextResponse } from 'next/server';
import { workos } from '@/lib/workos';
import { prisma } from '@/lib/prisma';
import { getMaiksYtId } from '@/lib/id';

export async function POST(req: Request) {
  const payload = await req.text();
  const sig = req.headers.get('x-workos-signature');

  if (!sig || !process.env.WORKOS_WEBHOOK_SECRET) {
    console.error('Webhook secret or signature missing');
    return new Response('Webhook secret or signature missing', { status: 400 });
  }

  try {
    const event = await workos.webhooks.constructEvent({
      payload,
      sig,
      secret: process.env.WORKOS_WEBHOOK_SECRET,
    });

    switch (event.event) {
      case 'user.created': {
        const workosUser = event.data;
        
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { workosId: workosUser.id }
        });

        if (existingUser) {
          console.log(`User ${workosUser.id} already exists, skipping creation.`);
          break;
        }

        // Generate a base username from email
        const baseUsername = workosUser.email.split('@')[0];
        const uniqueSuffix = Math.random().toString(36).substring(2, 6);
        const username = `${baseUsername}_${uniqueSuffix}`;

        await prisma.user.create({
          data: {
            id: getMaiksYtId('user'),
            email: workosUser.email,
            workosId: workosUser.id,
            profile: {
              create: {
                id: getMaiksYtId('profile'),
                username,
                profileImage: workosUser.profilePictureUrl ?? null,
              },
            },
          },
        });
        console.log(`User created: ${workosUser.id}`);
        break;
      }

      case 'user.updated': {
        const workosUser = event.data;

        await prisma.user.upsert({
          where: { workosId: workosUser.id },
          update: {
            email: workosUser.email,
            profile: {
              upsert: {
                create: {
                  id: getMaiksYtId('profile'),
                  username: `${workosUser.email.split('@')[0]}_${Math.random().toString(36).substring(2, 6)}`,
                  profileImage: workosUser.profilePictureUrl ?? null,
                },
                update: {
                  profileImage: workosUser.profilePictureUrl ?? null,
                },
              },
            },
          },
          create: {
            id: getMaiksYtId('user'),
            email: workosUser.email,
            workosId: workosUser.id,
            profile: {
              create: {
                id: getMaiksYtId('profile'),
                username: `${workosUser.email.split('@')[0]}_${Math.random().toString(36).substring(2, 6)}`,
                profileImage: workosUser.profilePictureUrl ?? null,
              },
            },
          },
        });
        console.log(`User updated/upserted: ${workosUser.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.event}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    return new Response(`Webhook Error: ${error.message}`, { status: 400 });
  }
}
