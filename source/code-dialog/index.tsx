"use client";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@sharadox/interface-web-library/button";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { CodeBoxes } from "@sharadox/interface-web-library/code-boxes";
import { Dialog } from "@sharadox/interface-web-library/dialog";
import { TextField } from "@sharadox/interface-web-library/text-field";
import styles from "./index.module.scss";
import type { CodeDialogProperties } from "@sharadox/account-web-library/code-dialog/type";

/** Minutes and seconds, as a clock shows them: 1:05. */
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** The seconds left of a code that lasts `lifetime` seconds from `since`, ticking every second. */
function useCountdown(lifetime: number | undefined, since: number): number | undefined {
  const [now, setNow] = useState(since);
  useEffect(() => {
    if (lifetime === undefined) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [lifetime, since]);
  if (lifetime === undefined) return undefined;
  return Math.max(0, lifetime - Math.floor((Math.max(now, since) - since) / 1_000));
}

/** The pop-up's inside, made again each time it opens (so the count and the boxes start afresh). */
function CodeBody({
  locale,
  onClose,
  text,
  kind = "digits",
  onSubmit,
  onResend,
  lifetimeSeconds,
}: Omit<CodeDialogProperties, "open" | "title">) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [resent, setResent] = useState(false);
  const [since, setSince] = useState(() => Date.now());
  const left = useCountdown(lifetimeSeconds, since);
  const errorId = useId();
  const words = ACCOUNT_WORDS.code;
  const expired = left === 0;

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

  const resend = async () => {
    setError(null);
    await onResend!();
    setResent(true);
    setSince(Date.now());
    setAttempt(attempt + 1);
  };

  return (
    <>
      <div className={styles.text}>{text}</div>
      {expired ? (
        <div className={styles.expired}>
          <p role="alert">{say(words.expired, locale)}</p>
          <div className={styles.buttons}>
            {onResend && <Button onClick={resend}>{say(words.resend, locale)}</Button>}
            <Button look="secondary" onClick={onClose}>
              {say(ACCOUNT_WORDS.common.cancel, locale)}
            </Button>
          </div>
        </div>
      ) : (
        <>
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
                label={say(words.recoveryLabel, locale)}
                name="code"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                required
              />
              <Button type="submit" pending={pending} pendingLabel={say(words.checking, locale)}>
                {say(words.confirm, locale)}
              </Button>
            </form>
          )}
          {left !== undefined && (
            <p className={styles.countdown}>
              {say(words.expiresIn, locale)} {clock(left)}
            </p>
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
            <Button look="plain" onClick={resend}>
              {say(words.resend, locale)}
            </Button>
          )}
        </>
      )}
    </>
  );
}

/**
 * A pop-up in the middle of the screen asking for a one-time code: 6 boxes sent the moment they're full (or one field
 * for a recovery code), a loader while it's checked, the reason when it's refused (the boxes start again), and "Send a
 * new code" for emailed codes. With `lifetimeSeconds`, a countdown shows how long the code lasts; once it runs out,
 * only "Send a new code" and "Cancel" are left.
 *
 * @example
 * <CodeDialog locale="en" open title="Check your email" text={…} lifetimeSeconds={600} onSubmit={check} onClose={close} />
 */
export function CodeDialog({ open, title, ...body }: CodeDialogProperties) {
  return (
    <Dialog open={open} onClose={body.onClose} title={title} closeLabel={say(ACCOUNT_WORDS.common.close, body.locale)}>
      <CodeBody {...body} />
    </Dialog>
  );
}
