/** One `@`, something either side, no spaces: the shape, not deliverability (the one-time code proves that). */
const SHAPE = /^[^\s@]+@[^\s@]+$/;

/**
 * An email contact in the one form it is stored and compared in: trimmed and lowercase. Throws for text that isn't
 * an email address.
 *
 * @example
 * normalizeEmail(" Luis@Example.com "); // "luis@example.com"
 */
export function normalizeEmail(address: string): string {
  const normalized = address.trim().toLowerCase();
  if (!SHAPE.test(normalized)) throw new Error("this is not an email address");
  return normalized;
}

/**
 * The form a banned email takes in the ban ledger: normalized, and without a `+tag`, so `name+1@…` can't stand in
 * for a banned `name@…`.
 *
 * @example
 * emailLedgerForm("Luis+Shop@Example.com"); // "luis@example.com"
 */
export function emailLedgerForm(address: string): string {
  const [local, domain] = normalizeEmail(address).split("@") as [string, string];
  return `${local.split("+")[0]}@${domain}`;
}
