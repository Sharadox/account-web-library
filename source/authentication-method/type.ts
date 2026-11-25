/** One way to sign in to an account, as its owner sees it. */
export type AuthenticationMethod =
  | { kind: "email"; id: string; value: string; required: boolean }
  | { kind: "authenticator"; id: string; name: string; required: boolean };

/** A way to sign in as someone who hasn't signed in yet sees it: no full addresses. */
export type MethodChoice =
  { kind: "email"; id: string; hint: string } | { kind: "authenticator"; id: string; name: string };
