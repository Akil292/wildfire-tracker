import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile?.(".env");
} catch {
  // .env may not exist in CI or minimal environments
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
    },
  },
});
