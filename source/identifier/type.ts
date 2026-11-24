/** An identifier that follows the rules (with its `key` for uniqueness), or why not. */
export type IdentifierCheck =
  { valid: true; identifier: string; key: string } | { valid: false; reason: "length" | "characters" };
