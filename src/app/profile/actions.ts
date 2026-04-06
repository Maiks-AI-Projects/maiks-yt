'use server';

import { auth } from "@workos-inc/authkit-nextjs";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AIService } from "@/lib/services/AIService";

/**
 * Server Action: Update Profile
 * Updates the username and bio in the Prisma database.
 */
export async function updateProfile(formData: FormData) {
  const { user } = await auth();
  if (!user) {
    redirect("/");
  }

  const username = formData.get("username") as string;
  const bio = (formData.get("bio") as string) || "";

  if (!username) {
    throw new Error("Username is required");
  }

  // AI Content Moderation: Check profile safety before saving
  const safetyResult = await AIService.checkProfileContent(username, bio);
  if (safetyResult.safetyScore < 40) {
    const flaggedInfo = safetyResult.flaggedTerms.length > 0 
      ? `: ${safetyResult.flaggedTerms.join(", ")}` 
      : "";
    throw new Error(`Profile content flagged for safety (Score: ${safetyResult.safetyScore})${flaggedInfo}`);
  }

  try {
    // 1. Get or create the base User record linked to WorkOS
    let dbUser = await prisma.user.findUnique({
      where: { workosId: user.id },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          workosId: user.id,
          email: user.email,
        },
      });
    }

    // 2. Upsert the Profile record
    await prisma.profile.upsert({
      where: { userId: dbUser.id },
      update: {
        username: username,
        bio: bio,
      },
      create: {
        userId: dbUser.id,
        username: username,
        bio: bio,
      },
    });

    revalidatePath("/profile");
  } catch (error: any) {
    console.error("Profile Update Error:", error);
    throw new Error(error.message || "Failed to update profile");
  }
}
