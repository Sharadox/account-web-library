import { createHash, randomBytes } from "node:crypto";

/**
 * A new session token (256 random bits, base64url) for a cookie, and the hash to store instead: a leaked table gives
 * no sessions. A plain SHA-256 is enough for tokens this random.
 *
 * @example
 * const { token, hash } = createSessionToken();
 */
export function createSessionToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashSessionToken(token) };
}

/**
 * The stored form of a session token.
 *
 * @example
 * hashSessionToken(cookie); // compare with browser_session.token_hash
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}
