import type { ReactNode } from "react";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

/** What every account action answers. */
export type AccountAnswer<Done extends object = object> =
  | ({ status: "done" } & Done)
  | { status: "step-up" }
  | { status: "refused"; reason: string; retryAfterSeconds?: number };

/** Confirming it's you: a fresh code to one of the account's emails. */
export interface StepUp {
  /** The email the code goes to, as shown ("ana@example.com"). */
  email: string;
  start: () => Promise<AccountAnswer<{ requestId: string }>>;
  finish: (requestId: string, code: string) => Promise<AccountAnswer>;
}

export interface AccountActionsProperties {
  locale: AccountLocale;
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
   * Runs an action: a loader meanwhile, a notification when done or refused (explained), and, when it needs a fresh
   * code, the code pop-up, then the action again. Resolves to the answer, or null when refused.
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
