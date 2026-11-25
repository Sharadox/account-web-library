import type { Challenge, Solution } from "@sharadox/protection-web-library/proof-of-work/type";
import type { MethodChoice } from "@sharadox/account-web-library/authentication-method/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

/** What every sign-in action answers. */
export type SignInAnswer =
  /** A code went to the email: ask for it with `requestId`. */
  | { status: "sent"; requestId: string }
  | { status: "signed-in" }
  /** This browser was already signed in to that account: nothing was sent. */
  | { status: "already" }
  /** No account has this email: choose a name and identifier. */
  | { status: "sign-up"; ticket: string }
  /** Choose a method (`choose`: the first, after an identifier; `more`: the next required one). */
  | { status: "choose" | "more"; ticket: string; methods: MethodChoice[]; recoveryCode: boolean }
  | { status: "refused"; reason: string; retryAfterSeconds?: number };

/** The server actions behind the sign-in screen (the site's, each a thin call into this library). */
export interface SignInActions {
  challenge: () => Promise<Challenge>;
  startWithEmail: (input: { email: string; solution: Solution }) => Promise<SignInAnswer>;
  startWithIdentifier: (input: { identifier: string; solution: Solution }) => Promise<SignInAnswer>;
  finishEmail: (input: { requestId: string; code: string }) => Promise<SignInAnswer>;
  sendStepCode: (input: { ticket: string; contactId: string }) => Promise<SignInAnswer>;
  finishStep: (input: {
    ticket: string;
    step:
      | { kind: "email"; requestId: string; code: string }
      | { kind: "authenticator"; id: string; code: string }
      | { kind: "recovery-code"; code: string };
  }) => Promise<SignInAnswer>;
  signUp: (input: { ticket: string; name: string; identifier: string }) => Promise<SignInAnswer>;
}

export interface SignInScreenProperties {
  locale: AccountLocale;
  /** The company, for "the code your authenticator app shows for …". */
  company: string;
  actions: SignInActions;
  /** Where to go once signed in. */
  next: string;
  /** The rules page, linked from the sign-up form. */
  rulesHref: string;
}
