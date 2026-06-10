// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      global: "globalThis",
    },
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
        "/health": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        buffer: "buffer/",
        "@oscorp/x402-payer": path.resolve(rootDir, "../x402-payer/src/index.ts"),
      },
    },
    optimizeDeps: {
      include: [
        "buffer",
        "process",
        "tweetnacl",
        "lute-connect",
        "@perawallet/connect",
        "@blockshake/defly-connect",
        "@x402-avm/avm",
        "@x402-avm/core",
        "@x402-avm/fetch",
      ],
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
    ssr: {
      noExternal: ["@txnlab/use-wallet", "@txnlab/use-wallet-react"],
    },
  },
});
