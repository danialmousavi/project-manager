import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["lib/iranian-identity.ts", "lib/jalali.ts", "lib/project-progress.ts", "lib/task-*-history.ts"],
      reporter: ["text", "json-summary"],
    },
  },
});
