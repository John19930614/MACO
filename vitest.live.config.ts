import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

/**
 * LIVE integration tests — run against a real local Postgres (Supabase via
 * Docker), NOT the mock layer. Kept separate from `vitest.config.ts` so the
 * default `npm test` stays fast and offline. Run with `npm run test:live`,
 * which boots the stack and injects the local keys.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The real `server-only` package throws outside a react-server context;
      // stub it so AI modules (provider/engine/telemetry) import under Node.
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["test-live/**/*.live.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
