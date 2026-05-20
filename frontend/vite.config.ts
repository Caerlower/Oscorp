// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

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
      },
    },
    optimizeDeps: {
      include: [
        "buffer",
        "process",
        "lute-connect",
        "@perawallet/connect",
        "@blockshake/defly-connect",
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
