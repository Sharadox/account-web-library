import { expect, test } from "vitest";
import { emailLedgerForm, normalizeEmail } from "@sharadox/account-web-library/email-contact";

test("an email contact is stored trimmed and lowercase, so one address is one contact", () => {
  expect(normalizeEmail("  Luis.Pires@Example.COM ")).toBe("luis.pires@example.com");
});

test("the ban ledger also drops +tags, so a banned address can't come back as address+1", () => {
  expect(emailLedgerForm("Luis+Shop@Example.com")).toBe("luis@example.com");
  expect(emailLedgerForm("luis@example.com")).toBe("luis@example.com");
});

test("refuses text that isn't an email address", () => {
  expect(() => normalizeEmail("not an address")).toThrow("not an email address");
  expect(() => normalizeEmail("a@b@c")).toThrow("not an email address");
});
