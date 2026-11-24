/** A name that follows the rules (trimmed, single spaces), or why not. */
export type AccountNameCheck = { valid: true; name: string } | { valid: false; reason: "length" | "characters" };
