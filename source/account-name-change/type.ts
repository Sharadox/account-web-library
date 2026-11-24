export type AccountNameChangeResult = { changed: true } | { changed: false; reason: "name-invalid" | "no-account" };
