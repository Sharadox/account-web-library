export type IdentifierChangeResult =
  { changed: true } | { changed: false; reason: "identifier-invalid" | "identifier-taken" | "no-account" };
