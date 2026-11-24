import { expect, test } from "vitest";
import { createRecoveryCodes, normalizeRecoveryCode } from "@sharadox/account-web-library/recovery-code";

test("ten codes of three groups of four, from characters people don't confuse", () => {
  const codes = createRecoveryCodes();
  expect(codes).toHaveLength(10);
  for (const code of codes)
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}(-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}){2}$/);
  expect(new Set(codes).size).toBe(10);
  expect(createRecoveryCodes(3)).toHaveLength(3);
});

test("reads a code however it is typed back", () => {
  expect(normalizeRecoveryCode(" abcd-efgh-jkmn ")).toBe("ABCDEFGHJKMN");
  expect(normalizeRecoveryCode("ABCD EFGH JKMN")).toBe("ABCDEFGHJKMN");
});
