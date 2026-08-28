import { createHash } from "node:crypto";

import { publicMusicSelectionReferencePrefix } from "@maiks-yt/domain/music";

const publicMusicSelectionReferenceDomain = "maiks-yt:music-public-selection-reference:v1";

export const buildPublicMusicSelectionReference = (input: {
  trackId: string;
  sourceId: string;
}): string => {
  const digest = createHash("sha256")
    .update(publicMusicSelectionReferenceDomain, "utf8")
    .update("\0", "utf8")
    .update(input.trackId, "utf8")
    .update("\0", "utf8")
    .update(input.sourceId, "utf8")
    .digest("hex");

  return `${publicMusicSelectionReferencePrefix}${digest}`;
};

export const publicMusicSelectionReferenceSql = (
  trackIdExpression: string,
  sourceIdExpression: string
): string =>
  `CONCAT('${publicMusicSelectionReferencePrefix}', LOWER(SHA2(CONCAT('${publicMusicSelectionReferenceDomain}', CHAR(0), ${trackIdExpression}, CHAR(0), ${sourceIdExpression}), 256)))`;
