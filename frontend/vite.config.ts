// @lovable.dev/vite-tanstack-config bundles tanstackStart, viteReact, tailwindcss, etc.
// Pass extra Vite options via defineConfig({ vite: { ... } }).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Vercel builds need Nitro's default output layout (.vercel/output/functions/__server.func).
// @lovable.dev/vite-tanstack-config otherwise forces dist/server, which breaks Vercel routing.
const nitro = process.env.VERCEL
  ? {
      preset: "vercel" as const,
      output: {
        dir: ".vercel/output",
        serverDir: ".vercel/output/functions/__server.func",
        publicDir: ".vercel/output/static",
      },
    }
  : false;

// Custom SSR entry wraps TanStack Start with branded error pages.
export default defineConfig({
  nitro,
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
        crypto: "crypto-browserify",
        stream: "stream-browserify",
        "@oscorp/x402-payer": path.resolve(rootDir, "src/services/x402-payer.ts"),
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
      ],
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
    ssr: {
      noExternal: [
        "@txnlab/use-wallet",
        "@txnlab/use-wallet-react",
        "@x402-avm/avm",
        "@x402-avm/core",
        "@x402-avm/fetch",
      ],
    },
  },
});
