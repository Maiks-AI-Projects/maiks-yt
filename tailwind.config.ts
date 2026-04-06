import type { Config } from "tailwindcss";

/** 
 * Tailwind CSS Config for Maiks-YT-Dev.
 * Note: Tailwind v4 primarily uses CSS variables for configuration, 
 * but this file is maintained for tool compatibility and specific overrides.
 */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Map to CSS variables for dynamic skinning
        primary: "var(--primary)",
        secondary: "var(--secondary)",
        accent: "var(--accent)",
      },
    },
  },
  plugins: [],
} satisfies Config;
