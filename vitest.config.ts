import { mergeConfig } from "vitest/config";
import { defineLibraryTest } from "@sharadox/vitest-configuration-web-library/library-test";

// Each server test starts its own Postgres in memory (PGlite), which takes a few seconds when many start at once.
// Component tests choose happy-dom in their first line (`// @vitest-environment happy-dom`).
export default mergeConfig(defineLibraryTest({ root: new URL("./", import.meta.url), react: true }), {
  test: { testTimeout: 60_000, hookTimeout: 60_000 },
});
