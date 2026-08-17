import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  processProfileImage,
  profileImageMaxInputBytes,
  profileImageOutputSize
} from "../../src/account/profile-image.service.js";

describe("profile image processing", () => {
  it("normalizes supported images to a square WebP avatar", async () => {
    const source = await sharp({
      create: {
        width: 900,
        height: 500,
        channels: 3,
        background: { r: 28, g: 180, b: 140 }
      }
    }).png().toBuffer();

    const result = await processProfileImage(source.toString("base64"));

    expect(result).not.toBeNull();
    const metadata = await sharp(result as Buffer).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(profileImageOutputSize);
    expect(metadata.height).toBe(profileImageOutputSize);
  });

  it("rejects malformed and oversized input", async () => {
    await expect(processProfileImage("not-base64!"))
      .resolves.toBeNull();
    await expect(processProfileImage(Buffer.alloc(profileImageMaxInputBytes + 1).toString("base64")))
      .resolves.toBeNull();
  });
});
