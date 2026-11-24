import { normalizeEmail } from "@sharadox/account-web-library/email-contact";
import type { Contact } from "@sharadox/account-web-library/contact-kind/type";

const NORMALIZERS: Record<string, (value: string) => string> = { email: normalizeEmail };

/** The kinds of contact this version can store and send codes to. */
export const CONTACT_KINDS = Object.keys(NORMALIZERS);

/**
 * A contact in the one form it is stored and compared in (an email trimmed and lowercase…). Throws for a kind this
 * version doesn't know, or a value that isn't valid for its kind.
 *
 * @example
 * normalizeContact({ kind: "email", value: " Luis@Example.com " }); // { kind: "email", value: "luis@example.com" }
 */
export function normalizeContact({ kind, value }: Contact): Contact {
  const normalize = NORMALIZERS[kind];
  if (!normalize) throw new Error(`unknown contact kind "${kind}"`);
  return { kind, value: normalize(value) };
}
