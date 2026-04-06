'use server';

import { AIService } from "@/lib/services/AIService";
import { triggerEvent, EVENT_TYPES } from "@/lib/events";
import { auth } from "@workos-inc/authkit-nextjs";

/**
 * Server Action: Send Message
 * Performs AI moderation on the message before broadcasting it via SSE.
 */
export async function sendChatMessage(message: string, platform: 'youtube' | 'twitch' = 'youtube') {
  const { user } = await auth();
  if (!user) {
    throw new Error("Unauthorized");
  }

  // AI Moderation Step
  const moderationResult = await AIService.moderateChatMessage(message);
  
  // If the message is blocked, do not broadcast it
  if (moderationResult.decision === 'Block') {
    return { success: false, reason: moderationResult.reason };
  }

  const channel = 'global';
  const data = {
    platform,
    author: user.firstName || user.email || 'User',
    message: message,
    avatar: user.profilePictureUrl,
    flagged: moderationResult.decision === 'Flag', // Mark as flagged if AI suggests it
    moderationReason: moderationResult.reason
  };

  // Broadcast the moderated message to all connected SSE clients
  triggerEvent(channel, EVENT_TYPES.CHAT, data);

  return { 
    success: true, 
    flagged: moderationResult.decision === 'Flag',
    reason: moderationResult.reason
  };
}
