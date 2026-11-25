import { expect, test } from "vitest";
import { authenticatorDate, authenticatorLabel } from "@sharadox/account-web-library/authenticator-label";

test("an authenticator is called by its name, or by the day it was added", () => {
  expect(authenticatorLabel({ name: "Phone", createdAt: "2026-11-25T10:00:00Z" }, "en")).toBe("Phone");
  expect(authenticatorLabel({ name: null, createdAt: "2026-11-25T10:00:00Z" }, "en")).toBe("Added 25 Nov 2026");
  expect(authenticatorLabel({ name: null, createdAt: new Date("2026-11-25T10:00:00Z") }, "pt")).toBe(
    "Adicionada a 25/11/2026",
  );
  expect(authenticatorDate("2026-01-02T23:30:00Z", "en")).toBe("2 Jan 2026");
});
