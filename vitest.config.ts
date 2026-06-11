import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Match the tsconfig "@/*" path alias so store/component tests resolve.
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    // Engine and data tests are pure TypeScript (RULE 1) — node env, no DOM.
    environment: "node",
    include: ["lib/**/*.test.ts", "store/**/*.test.ts"],
    passWithNoTests: true,
  },
});
