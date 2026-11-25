import { expect, test } from "vitest";
import { CODE_LIFETIME_SECONDS } from "@sharadox/account-web-library/code-lifetime";

test("a code lasts ten minutes", () => {
  expect(CODE_LIFETIME_SECONDS).toBe(600);
});
