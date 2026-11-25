import type { ReactNode } from "react";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface CodeDialogProperties {
  locale: AccountLocale;
  open: boolean;
  onClose: () => void;
  title: string;
  /** Where the code is, what it's for. */
  text: ReactNode;
  /** `digits`: 6 boxes, sent as soon as they're full; `recovery`: one field for a recovery code. */
  kind?: "digits" | "recovery";
  /** Checks the code: an error to show, or null when it passed (the caller then closes or moves on). */
  onSubmit: (code: string) => Promise<string | null>;
  /** A "Send a new code" button, for emailed codes. */
  onResend?: () => Promise<void>;
  /** How long the code lasts from the moment it's asked for (an emailed code: 600): shown as a countdown. */
  lifetimeSeconds?: number;
}
