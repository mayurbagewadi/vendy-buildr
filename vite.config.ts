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
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === '.htaccess') return '.htaccess';
          return 'assets/[name]-[hash][extname]';
        },
        // ─── Vendor chunk splitting ────────────────────────────────────────────
        // ONLY libraries that are already in the STATIC import chain (landing page).
        // Libraries used exclusively in lazy pages (recharts, xlsx) must NOT be
        // listed here — manualChunks pulls them into the eager load graph,
        // causing Recharts/D3 (155 KiB) to load on the landing page when it
        // should only load on the admin Analytics page.
        manualChunks(id) {
          // framer-motion — statically used by IntroAudio → Index.tsx.
          // Separating it makes it independently cacheable across deploys.
          if (
            id.includes('/framer-motion/') || id.includes('\\framer-motion\\') ||
            id.includes('/motion-dom/')     || id.includes('\\motion-dom\\')    ||
            id.includes('/motion-utils/')   || id.includes('\\motion-utils\\')
          ) {
            return 'vendor-motion';
          }
          // Supabase JS — statically used by Index.tsx for platform settings fetch.
          if (id.includes('/@supabase/') || id.includes('\\@supabase\\')) {
            return 'vendor-supabase';
          }
          // TanStack React Query — statically used in App.tsx QueryClientProvider.
          if (id.includes('/@tanstack/') || id.includes('\\@tanstack\\')) {
            return 'vendor-query';
          }
          // recharts, d3, xlsx — intentionally excluded: they live in lazy page
          // chunks (Analytics, Orders) and must never load on the landing page.
        },
      },
    },
  },
  publicDir: 'public',
}));
