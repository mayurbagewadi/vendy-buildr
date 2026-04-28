import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import robotsTxtPlugin from "./vite-plugin-robots";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    robotsTxtPlugin()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // Keep .htaccess file name as is
          if (assetInfo.name === '.htaccess') {
            return '.htaccess';
          }
          return 'assets/[name]-[hash][extname]';
        },
        // Split vendors into separate cached chunks — browsers re-use them across pages
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('react-router')) {
            return 'vendor-react';
          }
          if (id.includes('@radix-ui') || id.includes('cmdk') || id.includes('vaul')) {
            return 'vendor-ui';
          }
          if (id.includes('gsap')) {
            return 'vendor-gsap';
          }
          if (id.includes('@supabase')) {
            return 'vendor-supabase';
          }
          if (id.includes('framer-motion')) {
            return 'vendor-framer';
          }
          if (id.includes('@tanstack')) {
            return 'vendor-query';
          }
          if (id.includes('lottie')) {
            return 'vendor-lottie';
          }
          return 'vendor-misc';
        },
      },
    },
  },
  publicDir: 'public',
}));
