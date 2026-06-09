import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["overlay-dev.maiks.yt"],
    port: 3002,
    strictPort: true
  }
});
