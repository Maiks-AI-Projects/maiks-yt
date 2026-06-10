export type LabPageKind = "landing" | "projects" | "profile" | "schedule" | "links" | "affiliate" | "transparency";

export type LabTheme = {
  slug: string;
  title: string;
  subtitle: string;
  kind: LabPageKind;
  tokens: {
    background: string;
    foreground: string;
    muted: string;
    panel: string;
    accent: string;
    danger: string;
    warning: string;
    success: string;
  };
};

export const labThemes: readonly LabTheme[] = [
  {
    slug: "satisfactory",
    title: "Satisfactory Factory Streams",
    subtitle: "Factory planning, automation, milestones, and community-funded builds.",
    kind: "landing",
    tokens: {
      background: "#15120f",
      foreground: "#f8f1e7",
      muted: "#b9aa96",
      panel: "#241d17",
      accent: "#f2842f",
      danger: "#e05252",
      warning: "#f5c451",
      success: "#76c66a"
    }
  },
  {
    slug: "minecraft",
    title: "Minecraft Community Builds",
    subtitle: "Survival projects, server goals, verified IGN profiles, and build showcases.",
    kind: "landing",
    tokens: {
      background: "#10180f",
      foreground: "#f4f8ef",
      muted: "#a9b99f",
      panel: "#1d2a19",
      accent: "#67b84f",
      danger: "#d9534f",
      warning: "#e6b84a",
      success: "#7bd66f"
    }
  },
  {
    slug: "coding",
    title: "Build Streams",
    subtitle: "Transparent software work, todos, milestones, and calm progress tracking.",
    kind: "landing",
    tokens: {
      background: "#111417",
      foreground: "#edf3f7",
      muted: "#a3b0b9",
      panel: "#1c2329",
      accent: "#64b5f6",
      danger: "#ff6b6b",
      warning: "#ffd166",
      success: "#5dd39e"
    }
  },
  {
    slug: "community",
    title: "Maiks.yt Community",
    subtitle: "One home for streams, projects, profiles, links, and public transparency.",
    kind: "landing",
    tokens: {
      background: "#17151b",
      foreground: "#f7f2ff",
      muted: "#b9adc7",
      panel: "#24202b",
      accent: "#d19df2",
      danger: "#f06f75",
      warning: "#f4c95d",
      success: "#79d69f"
    }
  },
  {
    slug: "projects",
    title: "Project Goals",
    subtitle: "Nested projects, items, voting, funding progress, and clear overflow rules.",
    kind: "projects",
    tokens: {
      background: "#f5f7fb",
      foreground: "#141920",
      muted: "#5a6570",
      panel: "#ffffff",
      accent: "#2f6fed",
      danger: "#cc3d3d",
      warning: "#a66b00",
      success: "#238a55"
    }
  },
  {
    slug: "profile",
    title: "Community Profile",
    subtitle: "Linked accounts, verified IGNs, public badges, and privacy-first controls.",
    kind: "profile",
    tokens: {
      background: "#f4f6f4",
      foreground: "#18211c",
      muted: "#607066",
      panel: "#ffffff",
      accent: "#27856b",
      danger: "#b84a4a",
      warning: "#9f7618",
      success: "#2f8f5b"
    }
  },
  {
    slug: "schedule",
    title: "Stream Schedule",
    subtitle: "Upcoming streams, cancellations, platform links, and health-aware updates.",
    kind: "schedule",
    tokens: {
      background: "#101827",
      foreground: "#edf4ff",
      muted: "#a9b6c8",
      panel: "#172235",
      accent: "#77a7ff",
      danger: "#ff7777",
      warning: "#ffd166",
      success: "#74d39a"
    }
  },
  {
    slug: "links",
    title: "Links Hub",
    subtitle: "A clean linktree-style page for channels, socials, RSS, Discord, and support.",
    kind: "links",
    tokens: {
      background: "#181818",
      foreground: "#f5f5f5",
      muted: "#b6b6b6",
      panel: "#242424",
      accent: "#f0c14b",
      danger: "#f06262",
      warning: "#ffcf66",
      success: "#6ed096"
    }
  },
  {
    slug: "affiliate",
    title: "Affiliate Disclosure",
    subtitle: "Clear income-source messaging without pretending every link is a recommendation.",
    kind: "affiliate",
    tokens: {
      background: "#f7f5f0",
      foreground: "#1e1d19",
      muted: "#6d675d",
      panel: "#ffffff",
      accent: "#8a6f2a",
      danger: "#bf4b4b",
      warning: "#a87500",
      success: "#527f45"
    }
  },
  {
    slug: "transparency",
    title: "Transparency Ledger",
    subtitle: "Public withdrawals, archived projects, spending summaries, and user trust.",
    kind: "transparency",
    tokens: {
      background: "#eef4f8",
      foreground: "#111c24",
      muted: "#536774",
      panel: "#ffffff",
      accent: "#1d7ea6",
      danger: "#bf3f4a",
      warning: "#b26a00",
      success: "#227f60"
    }
  }
];

export const getLabTheme = (slug: string): LabTheme | undefined => labThemes.find((theme) => theme.slug === slug);

