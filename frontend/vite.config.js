import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    assetsDir: "assets",
    sourcemap: false
  },
  preview: {
    host: true,
    allowedHosts: ["findr.dcism.org", "localhost", "127.0.0.1"],
    proxy: { "/api": "http://localhost:5000" }
  },
  server: {
    host: true,
    proxy: { "/api": "http://localhost:5000" },
    allowedHosts: [
      "findr.dcism.org",
      "localhost",
      "127.0.0.1"
    ]
  }
});