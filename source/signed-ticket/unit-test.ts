import { expect, test } from "vitest";
import { createTicket, readTicket } from "@sharadox/account-web-library/signed-ticket";

const secret = "a-secret-of-at-least-thirty-two-characters";

test("a ticket carries its data until it expires, signed so nobody can change it", () => {
  const ticket = createTicket(
    { contact: { kind: "email", value: "a@example.com" } },
    { secret, purpose: "sign-up", lifetimeSeconds: 60, now: 0 },
  );
  expect(readTicket(ticket, { secret, purpose: "sign-up", now: 59_999 })).toEqual({
    valid: true,
    data: { contact: { kind: "email", value: "a@example.com" } },
  });
  expect(readTicket(ticket, { secret, purpose: "sign-up", now: 60_000 })).toEqual({ valid: false, reason: "expired" });
});

test("refuses changed tickets, other purposes and other secrets", () => {
  const ticket = createTicket({ n: 1 }, { secret, purpose: "sign-up", lifetimeSeconds: 60, now: 0 });
  const [body, signature] = ticket.split(".") as [string, string];
  const changed = `${Buffer.from(JSON.stringify({ data: { n: 2 }, purpose: "sign-up", expiresAt: 60_000 })).toString("base64url")}.${signature}`;
  expect(readTicket(changed, { secret, purpose: "sign-up", now: 0 })).toEqual({ valid: false, reason: "signature" });
  expect(readTicket(ticket, { secret, purpose: "other", now: 0 })).toEqual({ valid: false, reason: "signature" });
  expect(readTicket(ticket, { secret: `${secret}!`, purpose: "sign-up", now: 0 })).toEqual({
    valid: false,
    reason: "signature",
  });
  expect(readTicket(`${body}`, { secret, purpose: "sign-up", now: 0 })).toEqual({ valid: false, reason: "signature" });
  expect(readTicket("not.a-ticket", { secret, purpose: "sign-up", now: 0 })).toEqual({
    valid: false,
    reason: "signature",
  });
});

test("uses the current time by default", () => {
  const ticket = createTicket("x", { secret, purpose: "p", lifetimeSeconds: 60 });
  expect(readTicket(ticket, { secret, purpose: "p" })).toEqual({ valid: true, data: "x" });
});
