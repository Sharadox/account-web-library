import type { ReactNode } from "react";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";
import type { MethodChoice } from "@sharadox/account-web-library/authentication-method/type";

/** What every account action answers. */
export type AccountAnswer<Done extends object = object> =
  | ({ status: "done" } & Done)
  | { status: "step-up" }
  | { status: "refused"; reason: string; retryAfterSeconds?: number };

/** One way of confirming it's you, as typed. */
export type StepUpStepInput =
  | { kind: "email"; requestId: string; code: string }
  | { kind: "authenticator"; id: string; code: string }
  | { kind: "recovery-code"; code: string };

/**
 * Confirming it's you, with any of the account's methods (all the required ones, when it has some): the server's
 * `stepUpMethods`, `startStepUp` and `finishStepUp`, as actions.
 */
export interface StepUp {
  /** The ways to confirm: every required one (`all`), or any one of them (`one`). */
  methods: () => Promise<
    AccountAnswer<{ ticket: string; mode: "all" | "one"; methods: MethodChoice[]; recoveryCode: boolean }>
  >;
  /** Sends a code to one of the account's emails. */
  send: (contactId: string) => Promise<AccountAnswer<{ requestId: string }>>;
  /** Checks one step: done, or done with required methods `left` and the ticket for the next. */
  finish: (ticket: string, step: StepUpStepInput) => Promise<AccountAnswer<{ ticket?: string; left?: string[] }>>;
}

export interface AccountActionsProperties {
  locale: AccountLocale;
  /** The company's name, in the authenticator's code pop-up ("the code for Luis Pires Decor"). */
  company: string;
  stepUp: StepUp;
  children: ReactNode;
}

export interface RunOptions<Done extends object> {
  /** The notification once done (none when left out). */
  success?: string;
  /** After it's done, with what it gave back. */
  onDone?: (answer: { status: "done" } & Done) => void;
  /** Read the page's data again once done (true by default). */
  refresh?: boolean;
}

export interface AccountActionRunner {
  /** Whether an action is running. */
  pending: boolean;
  /**
   * Runs an action: a loader meanwhile, a notification when done or refused (explained), and, when it needs
   * confirming it's you, the list of ways to confirm, then the action again. Resolves to the answer, or null when
   * refused.
   */
  run: <Done extends object>(
    action: () => Promise<AccountAnswer<Done>>,
    options?: RunOptions<Done>,
  ) => Promise<({ status: "done" } & Done) | null>;
  /** The same, for forms that show the refusal themselves: resolves to the explained refusal, or null when done. */
  submit: <Done extends object>(
    action: () => Promise<AccountAnswer<Done>>,
    options?: RunOptions<Done>,
  ) => Promise<string | null>;
}
