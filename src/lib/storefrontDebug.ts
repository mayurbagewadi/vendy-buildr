type StorefrontDebugResult = {
  ok: boolean;
  loadedAssets: string[];
  suspiciousAssets: string[];
};

type StorefrontDebugApi = {
  app: "new-storefront";
  entry: "src/storefront-main.tsx";
  buildCommand: "npm run build:storefront";
  outputDir: "dist-storefront";
  excludedRuntimeAreas: string[];
  checkLoadedAssets: () => StorefrontDebugResult;
};

declare global {
  interface Window {
    __DD_STOREFRONT_DEBUG__?: StorefrontDebugApi;
  }
}

const suspiciousAssetPatterns = [
  "admin",
  "superadmin",
  "StoreGuard",
  "SuperAdminGuard",
  "AdminLayout",
  "SuperAdminLayout",
];

const excludedRuntimeAreas = [
  "src/App.tsx",
  "src/pages/admin/**",
  "src/pages/superadmin/**",
  "src/components/admin/**",
  "src/components/superadmin/**",
];

const getLoadedAssets = () => {
  const scriptUrls = Array.from(document.scripts)
    .map((script) => script.src)
    .filter(Boolean);

  const resourceUrls = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter(Boolean);

  return Array.from(new Set([...scriptUrls, ...resourceUrls]));
};

const checkLoadedAssets = (): StorefrontDebugResult => {
  const loadedAssets = getLoadedAssets();
  const suspiciousAssets = loadedAssets.filter((asset) =>
    suspiciousAssetPatterns.some((pattern) => asset.includes(pattern))
  );

  return {
    ok: suspiciousAssets.length === 0,
    loadedAssets,
    suspiciousAssets,
  };
};

export function installStorefrontDebug() {
  if (typeof window === "undefined") return;

  window.__DD_STOREFRONT_DEBUG__ = {
    app: "new-storefront",
    entry: "src/storefront-main.tsx",
    buildCommand: "npm run build:storefront",
    outputDir: "dist-storefront",
    excludedRuntimeAreas,
    checkLoadedAssets,
  };

  const params = new URLSearchParams(window.location.search);
  const debugEnabled =
    params.get("dd_storefront_debug") === "1" ||
    window.localStorage.getItem("dd_storefront_debug") === "1";

  if (!debugEnabled) return;

  window.setTimeout(() => {
    const result = checkLoadedAssets();
    console.group("[DigitalDukandar] New storefront debug");
    console.info("App:", window.__DD_STOREFRONT_DEBUG__?.app);
    console.info("Entry:", window.__DD_STOREFRONT_DEBUG__?.entry);
    console.info("Build command:", window.__DD_STOREFRONT_DEBUG__?.buildCommand);
    console.info("Output dir:", window.__DD_STOREFRONT_DEBUG__?.outputDir);
    console.info("Admin/superadmin loaded:", !result.ok);
    console.info("Suspicious assets:", result.suspiciousAssets);
    console.groupEnd();
  }, 0);
}
