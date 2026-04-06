/**
 * This file contains the configuration for all supported hobby subdomains.
 * Each subdomain represents a specific interest or channel within the Maiks.yt ecosystem.
 */

export interface SubdomainMetadata {
  title: string;
  themeColor: string;
}

export const SUBDOMAINS: Record<string, SubdomainMetadata> = {
  mc: {
    title: "Minecraft Adventures",
    themeColor: "#10b981", // Emerald 500
  },
  ht: {
    title: "Hytale Insights",
    themeColor: "#f59e0b", // Amber 500
  },
  sf: {
    title: "Starfield Explorations",
    themeColor: "#3b82f6", // Blue 500
  },
  talking: {
    title: "Talking Points",
    themeColor: "#ef4444", // Red 500
  },
  wow: {
    title: "World of Warcraft",
    themeColor: "#8b5cf6", // Violet 500
  },
  electronics: {
    title: "Electronics & Tinkering",
    themeColor: "#f97316", // Orange 500
  },
  printing: {
    title: "3D Printing & Design",
    themeColor: "#64748b", // Slate 500
  },
  coding: {
    title: "Software & Coding",
    themeColor: "#06b6d4", // Cyan 500
  },
  brain: {
    title: "Brain & Cognition",
    themeColor: "#ec4899", // Pink 500
  },
  tech: {
    title: "Technology & Gadgets",
    themeColor: "#71717a", // Zinc 500
  },
  ai: {
    title: "Artificial Intelligence",
    themeColor: "#a855f7", // Purple 500
  },
  outdoors: {
    title: "Outdoor Adventures",
    themeColor: "#22c55e", // Green 500
  },
  oddjobs: {
    title: "Odd Jobs & Projects",
    themeColor: "#78350f", // Amber 900
  },
};

/**
 * List of all supported subdomain keys for validation.
 */
export const VALID_SUBDOMAINS = Object.keys(SUBDOMAINS);
