export type UsernameChangeResult =
  { changed: true } | { changed: false; reason: "username-invalid" | "username-taken" | "no-account" };
