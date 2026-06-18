type ManifestIconPurpose = "any" | "maskable";

type ManifestIcon = {
  src: string;
  sizes: string;
  type: "image/svg+xml";
  purpose?: ManifestIconPurpose;
};

type ManifestShortcut = {
  name: string;
  short_name: string;
  description: string;
  url: string;
  icons: ManifestIcon[];
};

type StreamToolsManifest = {
  name: string;
  short_name: string;
  description: string;
  id: string;
  start_url: string;
  scope: string;
  display: "standalone";
  background_color: string;
  theme_color: string;
  categories: string[];
  icons: ManifestIcon[];
  shortcuts: ManifestShortcut[];
};

const streamToolsIcon = {
  src: "/icons/maiks-tools-icon.svg",
  sizes: "any",
  type: "image/svg+xml",
  purpose: "any"
} satisfies ManifestIcon;

const streamToolsManifest = {
  name: "Maiks.yt Stream Tools",
  short_name: "Maiks Tools",
  description: "Standalone stream operation tools for Maiks.yt.",
  id: "/tools/actions",
  start_url: "/tools/actions",
  scope: "/tools/",
  display: "standalone",
  background_color: "#edf1f5",
  theme_color: "#141920",
  categories: ["productivity", "utilities"],
  icons: [
    streamToolsIcon,
    {
      src: "/icons/maiks-tools-maskable.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "maskable"
    }
  ],
  shortcuts: [
    {
      name: "Action Panel",
      short_name: "Actions",
      description: "Open the standalone stream approval inbox.",
      url: "/tools/actions",
      icons: [streamToolsIcon]
    }
  ]
} satisfies StreamToolsManifest;

export const GET = (): Response =>
  new Response(JSON.stringify(streamToolsManifest), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/manifest+json; charset=utf-8"
    }
  });
