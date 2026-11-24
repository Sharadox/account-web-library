import { hkdfSync } from "node:crypto";

/**
 * A separate 256-bit key for one purpose (`one-time-code`, `rate-limit`, `proof-of-work`, `sign-up-ticket`…),
 * derived from the account server's one root secret with HKDF-SHA-256: one secret to keep, and a key leaked from one
 * use reveals nothing about the others.
 *
 * @example
 * const pepper = deriveSecret(process.env.ACCOUNT_SECRET!, "one-time-code");
 */
export function deriveSecret(root: string, purpose: string): string {
  if (root.length < 32) throw new Error("the account secret must have at least 32 characters");
  return Buffer.from(hkdfSync("sha256", root, "", `sharadox-account:${purpose}`, 32)).toString("base64url");
}
