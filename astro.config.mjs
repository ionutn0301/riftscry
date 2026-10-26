// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://riftscry.vercel.app",
  vite: {
    cacheDir: process.env.NODE_ENV === 'production' ? 'node_modules/.vite-production' : 'node_modules/.vite-development',
    optimizeDeps: { include: ['@nanostores/react', '@nanostores/persistent'] },
  },
  output: "static",
  devToolbar: { enabled: false },
  integrations: [react(), sitemap()],
});
