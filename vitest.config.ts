import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "fetcher/test/**/*.test.ts", "supabase/test/**/*.test.ts", "web/src/**/*.test.ts", "netlify/test/**/*.test.ts"],
  },
});
