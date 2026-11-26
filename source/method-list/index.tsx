"use client";
import { Icon } from "@sharadox/icon-web-library/icon";
import { Button } from "@sharadox/interface-web-library/button";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { authenticatorLabel } from "@sharadox/account-web-library/authenticator-label";
import styles from "./index.module.scss";
import type { MethodListProperties } from "@sharadox/account-web-library/method-list/type";

/**
 * The ways to confirm it's you, side by side and equally valid, each with its own button: an email's "Send Code", an
 * authenticator's or a recovery code's "Enter Code". Passed methods are checked. Used when signing in and before a
 * sensitive change; the caller opens the code pop-up for the method picked.
 *
 * @example
 * <MethodList locale="en" methods={methods} done={passed} recoveryCode onPick={open} />
 */
export function MethodList({ locale, methods, done = [], recoveryCode, pending = null, onPick }: MethodListProperties) {
  const words = ACCOUNT_WORDS.signIn;
  const step = ACCOUNT_WORDS.step;
  return (
    <ul className={styles.list}>
      {methods.map((method) => {
        const passed = done.includes(method.id);
        return (
          <li key={method.id} className={styles.method} data-done={passed ? "" : undefined}>
            <Icon name={method.kind === "email" ? "email" : "key"} className={styles.icon} />
            <span className={styles.what}>
              {method.kind === "email" ? (
                <>
                  {say(words.byEmail, locale)} <strong>{method.hint}</strong>
                </>
              ) : (
                <>
                  {say(words.byAuthenticator, locale)}: <strong>{authenticatorLabel(method, locale)}</strong>
                </>
              )}
            </span>
            {passed ? (
              <span className={styles.done}>
                <Icon name="check" />
                {say(step.confirmed, locale)}
              </span>
            ) : (
              <Button
                look="quiet"
                pending={pending === method.id}
                pendingLabel={say(words.sending, locale)}
                disabled={pending !== null && pending !== method.id}
                onClick={() => onPick(method)}
              >
                {say(method.kind === "email" ? step.sendCode : step.enterCode, locale)}
              </Button>
            )}
          </li>
        );
      })}
      {recoveryCode && (
        <li className={styles.method}>
          <Icon name="lock" className={styles.icon} />
          <span className={styles.what}>{say(words.byRecovery, locale)}</span>
          <Button look="quiet" disabled={pending !== null} onClick={() => onPick({ kind: "recovery-code" })}>
            {say(step.enterCode, locale)}
          </Button>
        </li>
      )}
    </ul>
  );
}
