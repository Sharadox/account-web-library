/** A username that follows the rules (with its `key` for uniqueness), or why not. */
export type UsernameCheck =
  { valid: true; username: string; key: string } | { valid: false; reason: "length" | "characters" };
