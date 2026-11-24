/** RFC 4648's base 32 alphabet. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Bytes as RFC 4648 base 32, without padding: how authenticator apps take a two-factor secret.
 *
 * @example
 * encodeBase32(new TextEncoder().encode("foobar")); // "MZXW6YTBOI"
 */
export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/**
 * Base 32 back to bytes, forgiving how people type it: lowercase, spaces and `=` padding are fine. Throws on any
 * other character.
 *
 * @example
 * decodeBase32("mzxw 6ytb oi"); // the bytes of "foobar"
 */
export function decodeBase32(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/[\s=]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const character of clean) {
    const index = ALPHABET.indexOf(character);
    if (index === -1) throw new Error(`"${character}" is not base 32`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}
