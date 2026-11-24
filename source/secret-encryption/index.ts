import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";
const keyBytes = (key: string) => {
  if (key.length < 32) throw new Error("the encryption key must have at least 32 characters");
  return createHash("sha256").update(key).digest();
};

/**
 * Encrypts a secret for storing in the database (a TOTP secret) with AES-256-GCM under a key kept outside it
 * (`deriveSecret(ACCOUNT_SECRET, "totp-encryption")`), so a leaked database dump reveals nothing. A fresh random IV
 * every time; the result is text: `v1.<iv>.<ciphertext and tag>`.
 *
 * @example
 * const sealed = encryptSecret(secret, deriveSecret(server.secret, "totp-encryption"));
 */
export function encryptSecret(secret: Uint8Array, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  const body = Buffer.concat([cipher.update(secret), cipher.final(), cipher.getAuthTag()]);
  return `${VERSION}.${iv.toString("base64url")}.${body.toString("base64url")}`;
}

/**
 * Decrypts what `encryptSecret` made; throws for a wrong key or anything changed.
 *
 * @example
 * const secret = decryptSecret(row.secret_ciphertext, key);
 */
export function decryptSecret(sealed: string, key: string): Uint8Array {
  const [version, iv, body] = sealed.split(".");
  if (version !== VERSION || !iv || !body) throw new Error("unknown encrypted secret format");
  const bytes = Buffer.from(body, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(key), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(bytes.subarray(-16));
  return new Uint8Array(Buffer.concat([decipher.update(bytes.subarray(0, -16)), decipher.final()]));
}
