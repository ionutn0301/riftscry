// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://riftscry.vercel.app",
  vite: {
    cacheDir: process.env.NODE_ENV === 'production' ? 'node_modules/.vite-production' : 'node_modules/.vite-development',
    optimizeDeps: { include: ['@nanostores/react', '@nanostores/persistent'] },
  },
  output: "static",
  adapter: vercel(),
  devToolbar: { enabled: false },
  integrations: [react(), sitemap()],
});
