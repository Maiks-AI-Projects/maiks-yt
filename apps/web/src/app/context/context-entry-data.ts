export type ContextEntry = {
  id: string;
  title: string;
  description: string;
  relatedLinks?: readonly {
    href: string;
    label: string;
  }[];
};

export const contextEntries: readonly ContextEntry[] = [
  {
    id: "building-in-public",
    title: "Building in public",
    description:
      "Michael shares plans, unfinished work, changed decisions, and mistakes while Maiks.yt is being built. A plan shown publicly is not a promise that the work is already finished.",
    relatedLinks: [
      { href: "/progress", label: "Build progress" },
      { href: "/projects", label: "Projects" }
    ]
  },
  {
    id: "family-schedule",
    title: "Family schedule",
    description:
      "Michael has his son half of the time. Family responsibilities are part of the planning around streams, project work, and availability.",
    relatedLinks: [{ href: "/schedule", label: "Stream schedule" }]
  },
  {
    id: "maiks-yt",
    title: "Maiks.yt",
    description:
      "Maiks.yt is Michael's independent home for streams, projects, community participation, creator tools, and the public record around that work.",
    relatedLinks: [{ href: "/about", label: "About Michael" }]
  },
  {
    id: "medical-context",
    title: "Medical context",
    description:
      "Health, treatment, therapy, and changing energy can affect when or how long Michael streams. The medical-history page holds the fuller record he has chosen to publish.",
    relatedLinks: [{ href: "/about/health", label: "Medical history" }]
  },
  {
    id: "seven-monitor-desk",
    title: "Seven-monitor desk",
    description:
      "Michael's intended streaming workspace uses seven monitors so the stream, chat, moderation, production tools, references, and system status can remain visible at the same time."
  },
  {
    id: "stream-break",
    title: "Stream break",
    description:
      "Michael stopped streaming while undergoing treatment and therapy. The current website and creator-platform work are part of preparing a practical return.",
    relatedLinks: [
      { href: "/about", label: "Who Michael is now" },
      { href: "/schedule", label: "Current schedule" }
    ]
  },
  {
    id: "v2",
    title: "V2",
    description:
      "V2 refers to the current rebuild of Maiks.yt: the public website, stream overlays, control tools, community systems, and supporting backend.",
    relatedLinks: [{ href: "/projects/maiks-yt-v2", label: "Maiks.yt V2 project" }]
  }
] as const;
