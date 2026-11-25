/** One way to sign in to an account, as its owner sees it. */
export type AuthenticationMethod =
  | { kind: "email"; id: string; value: string; required: boolean }
  | { kind: "authenticator"; id: string; name: string | null; required: boolean; createdAt: Date };

/** A way to sign in as someone who hasn't signed in yet sees it: no full addresses. */
export type MethodChoice =
  | { kind: "email"; id: string; hint: string }
  /** `name` null when none was given: `createdAt` (ISO) tells it apart. */
  | { kind: "authenticator"; id: string; name: string | null; createdAt: string };
