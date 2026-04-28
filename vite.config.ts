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
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // Keep .htaccess file name as is
          if (assetInfo.name === '.htaccess') {
            return '.htaccess';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  publicDir: 'public',
}));
