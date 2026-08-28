import type {
  StreamScheduleEntry,
  StreamScheduleGameLink,
  StreamScheduleGameLinkInput
} from "@maiks-yt/domain/schedule";

export type GameLinkFormState = {
  gameId: string;
  publicNote: string;
};

const toGameLinkInput = (link: StreamScheduleGameLink): StreamScheduleGameLinkInput => ({
  gameId: link.gameId,
  relationship: link.relationship,
  publicNote: link.publicNote,
  sortOrder: link.sortOrder
});

const dedupeGameLinks = (
  links: readonly StreamScheduleGameLinkInput[]
): StreamScheduleGameLinkInput[] => {
  const seenGameIds = new Set<string>();
  const uniqueLinks: StreamScheduleGameLinkInput[] = [];

  for (const link of links) {
    const gameId = link.gameId.trim();

    if (!gameId || seenGameIds.has(gameId)) {
      continue;
    }

    seenGameIds.add(gameId);
    uniqueLinks.push({ ...link, gameId });
  }

  return uniqueLinks;
};

const normalizeGameLinkOrder = (
  links: readonly StreamScheduleGameLinkInput[]
): StreamScheduleGameLinkInput[] => dedupeGameLinks(links).map((link, sortOrder) => ({
  ...link,
  sortOrder
}));

export const toGameLinkForm = (stream: StreamScheduleEntry): GameLinkFormState => ({
  gameId: stream.gameLinks[0]?.gameId ?? "",
  publicNote: stream.gameLinks[0]?.publicNote ?? ""
});

export const buildGameFocusLinksForSubmit = (
  stream: StreamScheduleEntry | null,
  form: GameLinkFormState
): StreamScheduleGameLinkInput[] => {
  const selectedGameId = form.gameId.trim();
  const selectedPublicNote = form.publicNote.trim() || null;
  const existingLinks = stream?.gameLinks ?? [];
  const selectedExistingLink = existingLinks.find(
    (link) => link.gameId.trim() === selectedGameId
  ) ?? null;
  const remainingLinks = existingLinks
    .slice(1)
    .filter((link) => link.gameId.trim() !== selectedGameId)
    .map(toGameLinkInput);

  if (!selectedGameId) {
    return normalizeGameLinkOrder(remainingLinks);
  }

  const primaryLink: StreamScheduleGameLinkInput = {
    gameId: selectedGameId,
    relationship: selectedExistingLink?.relationship ?? "planned",
    publicNote: selectedPublicNote,
    sortOrder: 0
  };

  return normalizeGameLinkOrder([primaryLink, ...remainingLinks]);
};
