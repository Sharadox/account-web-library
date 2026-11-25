import { expect, test } from "vitest";
import { formatAccountTime } from "@sharadox/account-web-library/account-time";

test("in the reader's language, in Portugal's time", () => {
  expect(formatAccountTime("2026-07-01T12:05:00.000Z", "en")).toBe("1 Jul 2026, 13:05");
  expect(formatAccountTime("2026-01-01T12:05:00.000Z", "pt")).toContain("12:05");
});
