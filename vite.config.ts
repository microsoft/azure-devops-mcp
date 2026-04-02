import path from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import react from "@vitejs/plugin-react";

// Maps app name → { entry HTML path, output filename }
const apps: Record<string, { entry: string; output: string }> = {
  "work-items": { entry: "src/apps/work-items/index.html", output: "work-items-app" },
};

const APP = process.env.APP;
if (!APP) {
  throw new Error("APP environment variable is not set. Use one of: " + Object.keys(apps).join(", "));
}

const appConfig = apps[APP];
if (!appConfig) {
  throw new Error(`Unknown app '${APP}'. Available: ${Object.keys(apps).join(", ")}`);
}

const isDevelopment = process.env.NODE_ENV === "development";

export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    {
      name: "rename-html-output",
      enforce: "post",
      generateBundle(_, bundle) {
        // Rename index.html → <app-name>.html in the output bundle
        const htmlKey = Object.keys(bundle).find((k) => k.endsWith(".html"));
        if (htmlKey && htmlKey !== `${appConfig.output}.html`) {
          const asset = bundle[htmlKey];
          asset.fileName = `${appConfig.output}.html`;
          bundle[`${appConfig.output}.html`] = asset;
          Reflect.deleteProperty(bundle, htmlKey);
        }
      },
    },
  ],
  root: path.dirname(appConfig.entry),
  build: {
    target: "es2022",
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment ? "esbuild" : false,

    rollupOptions: {
      input: path.resolve(appConfig.entry),
      output: {
        // Deterministic chunk/asset names for cache-busting
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
      treeshake: {
        moduleSideEffects: "no-external",
        preset: "recommended",
      },
    },
    outDir: path.resolve("dist"),
    emptyOutDir: false,
  },
});
