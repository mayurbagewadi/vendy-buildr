import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
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

const storefrontPublicDirectories = [
  "themes",
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

      for (const directory of storefrontPublicDirectories) {
        const source = path.resolve(__dirname, "public", directory);
        const target = path.resolve(outDir, directory);

        if (!existsSync(source)) continue;
        cpSync(source, target, { recursive: true });
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

function storefrontSpaFallback() {
  return {
    name: "storefront-spa-fallback",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "GET") return next();

        const url = req.url || "/";
        const acceptsHtml = req.headers.accept?.includes("text/html");
        const isViteInternal = url.startsWith("/@vite") || url.startsWith("/@react-refresh");
        const isSourceOrAsset =
          url.startsWith("/src/") ||
          url.startsWith("/node_modules/") ||
          url.startsWith("/themes/") ||
          /\.(js|mjs|ts|tsx|css|map|json|svg|png|jpg|jpeg|webp|gif|ico|txt|xml|webmanifest|woff2?)($|\?)/i.test(url);

        if (!acceptsHtml || isViteInternal || isSourceOrAsset || url === "/storefront.html") {
          return next();
        }

        try {
          const templatePath = path.resolve(__dirname, "storefront.html");
          const template = readFileSync(templatePath, "utf-8");
          const html = await server.transformIndexHtml(url, template);
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html");
          res.end(html);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

export default defineConfig({
  appType: "custom",
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
    storefrontSpaFallback(),
    webfontDownload([
      "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap",
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
