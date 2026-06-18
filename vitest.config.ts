import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The real `server-only` package throws unless the "react-server" resolve
      // condition is set (Next.js sets it; Vitest does not). Stub it in tests.
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Force mock mode so the repository/data layer uses in-memory fixtures.
    env: {
      NEXT_PUBLIC_SAFETYIQ_MOCK: "true",
    },
    include: ["test/**/*.test.ts"],
  },
});
