import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import robotsTxtPlugin from "./vite-plugin-robots";
import webfontDownload from "vite-plugin-webfont-dl";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    robotsTxtPlugin(),
    webfontDownload([
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&family=Inter:wght@300;400;500;600&display=swap'
    ]),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Raise warning threshold — xlsx/recharts are intentionally in their own chunks
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === '.htaccess') return '.htaccess';
          return 'assets/[name]-[hash][extname]';
        },
        // ─── Vendor chunk splitting ────────────────────────────────────────────
        // Separates heavy, rarely-changing libraries into their own cached chunks.
        // Each chunk's hash only changes when THAT library's version changes,
        // so user browsers keep them cached across app deployments.
        manualChunks(id) {
          // Recharts + D3 — 383 KiB raw. Only used in admin Analytics page.
          if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('\\recharts\\') || id.includes('\\d3-')) {
            return 'vendor-charts';
          }
          // xlsx — 429 KiB raw. Only used in admin Orders export.
          if (id.includes('/xlsx/') || id.includes('\\xlsx\\')) {
            return 'vendor-xlsx';
          }
          // framer-motion — 160 KiB raw. Only used in IntroAudio component.
          if (
            id.includes('/framer-motion/') || id.includes('\\framer-motion\\') ||
            id.includes('/motion-dom/')     || id.includes('\\motion-dom\\')    ||
            id.includes('/motion-utils/')   || id.includes('\\motion-utils\\')
          ) {
            return 'vendor-motion';
          }
          // Supabase JS client — large. Shared across auth + data pages.
          if (id.includes('/@supabase/') || id.includes('\\@supabase\\')) {
            return 'vendor-supabase';
          }
          // TanStack React Query — used everywhere but rarely updates.
          if (id.includes('/@tanstack/') || id.includes('\\@tanstack\\')) {
            return 'vendor-query';
          }
        },
      },
    },
  },
  publicDir: 'public',
}));
