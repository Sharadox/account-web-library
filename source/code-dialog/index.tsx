"use client";
import { useId, useState, type FormEvent } from "react";
import { AccountButton } from "@sharadox/account-web-library/account-button";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { CodeBoxes } from "@sharadox/account-web-library/code-boxes";
import { Dialog } from "@sharadox/account-web-library/dialog";
import { TextField } from "@sharadox/account-web-library/input-group";
import styles from "./index.module.scss";
import type { CodeDialogProperties } from "@sharadox/account-web-library/code-dialog/type";

/**
 * A pop-up asking for a one-time code: 6 boxes sent the moment they're full (or one field for a recovery code), a
 * loader while it's checked, the reason when it's refused (the boxes start again), and "Send a new code" for emailed
 * codes.
 *
 * @example
 * <CodeDialog locale="en" open title="Check your email" text={…} onSubmit={check} onClose={close} />
 */
export function CodeDialog({
  locale,
  open,
  onClose,
  title,
  text,
  kind = "digits",
  onSubmit,
  onResend,
}: CodeDialogProperties) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [resent, setResent] = useState(false);
  const errorId = useId();
  const words = ACCOUNT_WORDS.code;

  const submit = async (code: string) => {
    setPending(true);
    setError(null);
    const refusal = await onSubmit(code);
    setPending(false);
    if (refusal) {
      setError(refusal);
      setAttempt(attempt + 1);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} closeLabel={say(ACCOUNT_WORDS.common.close, locale)}>
      <div className={styles.text}>{text}</div>
      {kind === "digits" ? (
        <CodeBoxes
          key={attempt}
          label={say(words.label, locale)}
          digitLabel={say(words.digit, locale)}
          ofLabel={say(words.of, locale)}
          onComplete={submit}
          invalid={Boolean(error)}
          disabled={pending}
          describedBy={error ? errorId : undefined}
          autoFocus
        />
      ) : (
        <form
          className={styles.recovery}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void submit(String(new FormData(event.currentTarget).get("code") ?? ""));
          }}
        >
          <TextField
            key={attempt}
            label={say(words.recoveryTitle, locale)}
            name="code"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            required
          />
          <AccountButton type="submit" pending={pending} pendingLabel={say(words.checking, locale)}>
            {say(words.confirm, locale)}
          </AccountButton>
        </form>
      )}
      <p className={styles.status} aria-live="polite">
        {pending && kind === "digits" && say(words.checking, locale)}
        {resent && !pending && !error && say(words.resent, locale)}
      </p>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
      {onResend && (
        <AccountButton
          look="plain"
          onClick={async () => {
            setError(null);
            await onResend();
            setResent(true);
          }}
        >
          {say(words.resend, locale)}
        </AccountButton>
      )}
    </Dialog>
  );
}
