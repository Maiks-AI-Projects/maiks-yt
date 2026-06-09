import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ["control-dev.maiks.yt"],
    port: 3003,
    strictPort: true
  }
});
