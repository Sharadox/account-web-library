import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";
import type { MethodChoice } from "@sharadox/account-web-library/authentication-method/type";

/** A method picked from the list: one of the account's, or a recovery code. */
export type PickedMethod = MethodChoice | { kind: "recovery-code" };

export interface MethodListProperties {
  locale: AccountLocale;
  methods: readonly MethodChoice[];
  /** The ids of the methods already passed: checked, and no longer pickable. */
  done?: readonly string[];
  /** Offer a recovery code too. */
  recoveryCode?: boolean;
  /** The method being prepared (a code on its way): its button shows a loader. */
  pending?: string | null;
  onPick: (method: PickedMethod) => void;
}
