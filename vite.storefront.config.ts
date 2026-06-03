import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import webfontDownload from "vite-plugin-webfont-dl";

const storefrontPublicAssets = [
  "favicon.ico",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
  "android-chrome-192x192.png",
  "android-chrome-512x512.png",
  "site.webmanifest",
  "placeholder.svg",
  "logo.png",
  "whatsapp-icon.png",
];

function copyStorefrontPublicAssets() {
  return {
    name: "copy-storefront-public-assets",
    closeBundle() {
      const outDir = path.resolve(__dirname, "dist-storefront");

      for (const asset of storefrontPublicAssets) {
        const source = path.resolve(__dirname, "public", asset);
        const target = path.resolve(outDir, asset);

        if (!existsSync(source)) continue;
        mkdirSync(path.dirname(target), { recursive: true });
        copyFileSync(source, target);
      }

      writeFileSync(
        path.resolve(outDir, "robots.txt"),
        "User-agent: *\nAllow: /\n",
        "utf-8"
      );

      const storefrontHtml = path.resolve(outDir, "storefront.html");
      const indexHtml = path.resolve(outDir, "index.html");
      if (existsSync(storefrontHtml)) {
        copyFileSync(storefrontHtml, indexHtml);
      }
    },
  };
}

export default defineConfig({
  server: {
    host: "::",
    port: 8081,
  },
  preview: {
    host: "::",
    port: 4174,
  },
  plugins: [
    react(),
    webfontDownload([
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;800&family=Inter:wght@300;400;500;600&display=swap",
    ]),
    copyStorefrontPublicAssets(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist-storefront",
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: path.resolve(__dirname, "storefront.html"),
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === ".htaccess") return ".htaccess";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  publicDir: false,
});
