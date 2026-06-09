export type ThemeManifest = {
  id: string;
  label: string;
  cssFile: string;
  requiredVariables: readonly string[];
};

export const defaultTheme: ThemeManifest = {
  id: "default",
  label: "Default",
  cssFile: "default.css",
  requiredVariables: ["--maiks-bg", "--maiks-fg", "--maiks-accent"]
};
