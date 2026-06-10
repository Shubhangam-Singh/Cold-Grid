import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Engine and data tests are pure TypeScript (RULE 1) — node env, no DOM.
    environment: "node",
    include: ["lib/**/*.test.ts", "store/**/*.test.ts"],
    passWithNoTests: true,
  },
});
