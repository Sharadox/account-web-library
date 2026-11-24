import { createHmac, timingSafeEqual } from "node:crypto";
import type { TicketOptions, TicketReading } from "@sharadox/account-web-library/signed-ticket/type";

const sign = (secret: string, body: string) => createHmac("sha256", secret).update(body).digest("base64url");

/**
 * A short-lived, signed ticket carrying data between two steps (a proved contact from the code step to the
 * username step) without storing anything: the data can be read, but not changed or used for another purpose.
 *
 * @example
 * const ticket = createTicket({ contact }, { secret, purpose: "sign-up", lifetimeSeconds: 900 });
 */
export function createTicket(
  data: unknown,
  { secret, purpose, lifetimeSeconds, now = Date.now() }: TicketOptions & { lifetimeSeconds: number },
): string {
  const body = Buffer.from(JSON.stringify({ data, purpose, expiresAt: now + lifetimeSeconds * 1000 })).toString(
    "base64url",
  );
  return `${body}.${sign(secret, body)}`;
}

/**
 * The data of a ticket made by `createTicket`, if it is intact, for this purpose, and not expired.
 *
 * @example
 * const reading = readTicket<{ contact: Contact }>(ticket, { secret, purpose: "sign-up" });
 */
export function readTicket<Data>(
  ticket: string,
  { secret, purpose, now = Date.now() }: TicketOptions,
): TicketReading<Data> {
  const [body, signature, ...rest] = ticket.split(".");
  if (!body || !signature || rest.length > 0) return { valid: false, reason: "signature" };
  const expected = Buffer.from(sign(secret, body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    return { valid: false, reason: "signature" };
  const content = JSON.parse(Buffer.from(body, "base64url").toString()) as {
    data: Data;
    purpose: string;
    expiresAt: number;
  };
  if (content.purpose !== purpose) return { valid: false, reason: "signature" };
  if (content.expiresAt <= now) return { valid: false, reason: "expired" };
  return { valid: true, data: content.data };
}
