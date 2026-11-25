"use client";
import { useState, type FormEvent } from "react";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { AccountButton } from "@sharadox/account-web-library/account-button";
import { AccountCard } from "@sharadox/account-web-library/account-card";
import { ACCOUNT_WORDS, explainRefusal, say } from "@sharadox/account-web-library/account-words";
import { CodeDialog } from "@sharadox/account-web-library/code-dialog";
import { CODE_LIFETIME_SECONDS } from "@sharadox/account-web-library/code-lifetime";
import { normalizeEmail } from "@sharadox/account-web-library/email-contact";
import { TextField } from "@sharadox/account-web-library/input-group";
import { RequiredSwitch } from "@sharadox/account-web-library/required-switch";
import { useToast } from "@sharadox/account-web-library/toast";
import styles from "./index.module.scss";
import type { EmailMethodsProperties } from "@sharadox/account-web-library/email-methods/type";

/**
 * The account's emails as ways to sign in: each verified one can be required at every sign-in (the switch flips at
 * once) or removed (with a loader; the last can't). "Add an email" shows its field, whether it should be required
 * from the start, and Save and Cancel; saving sends the address a code, typed in a pop-up, which verifies it.
 *
 * @example
 * <EmailMethods locale="en" emails={emails} add={add} verify={verify} remove={remove} setRequired={setRequired} />
 */
export function EmailMethods({ locale, emails, add, verify, remove, setRequired }: EmailMethodsProperties) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<{ requestId: string; email: string; required: boolean } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const action = useAccountAction();
  const saving = useAccountAction();
  const { notify } = useToast();
  const words = ACCOUNT_WORDS;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const required = form.get("required") === "on";
    let email: string;
    try {
      email = normalizeEmail(String(form.get("email")));
    } catch {
      return setError(say(words.error.email, locale));
    }
    let requestId = "";
    const refusal = await saving.submit(() => add(email), {
      refresh: false,
      onDone: (answer) => (requestId = answer.requestId),
    });
    if (refusal) return setError(refusal);
    setAdding(false);
    setVerifying({ requestId, email, required });
  };

  return (
    <AccountCard title={say(words.security.emails, locale)}>
      <ul className={styles.list}>
        {emails.map((email) => (
          <li key={email.id} className={styles.item} aria-busy={removing === email.id || undefined}>
            <span className={styles.value}>{email.value}</span>
            {email.verified && (
              <RequiredSwitch
                label={say(words.security.requiredToggle, locale)}
                checked={email.required}
                onChange={async (required) =>
                  (await action.run(() => setRequired(email.id, required), {
                    success: say(words.common.saved, locale),
                  })) !== null
                }
              />
            )}
            <AccountButton
              look="plain"
              icon="trash"
              pending={removing === email.id}
              pendingLabel={say(words.common.removing, locale)}
              onClick={async () => {
                setRemoving(email.id);
                await action.run(() => remove(email.id), { success: say(words.common.done, locale) });
                setRemoving(null);
              }}
            >
              {say(words.common.remove, locale)}
            </AccountButton>
          </li>
        ))}
      </ul>
      {adding ? (
        <form className={styles.form} onSubmit={submit} noValidate>
          <TextField
            label={say(words.security.addEmail, locale)}
            name="email"
            type="email"
            autoComplete="email"
            maxLength={320}
            error={error}
            required
            autoFocus
          />
          <label className={styles.choice}>
            <input type="checkbox" name="required" />
            <span>{say(words.security.requiredToggle, locale)}</span>
          </label>
          <div className={styles.buttons}>
            <AccountButton type="submit" pending={saving.pending} pendingLabel={say(words.signIn.sending, locale)}>
              {say(words.common.save, locale)}
            </AccountButton>
            <AccountButton
              look="quiet"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
            >
              {say(words.common.cancel, locale)}
            </AccountButton>
          </div>
        </form>
      ) : (
        <AccountButton look="quiet" icon="plus" onClick={() => setAdding(true)} className={styles.add}>
          {say(words.security.addEmail, locale)}
        </AccountButton>
      )}
      <CodeDialog
        lifetimeSeconds={CODE_LIFETIME_SECONDS}
        locale={locale}
        open={verifying !== null}
        onClose={() => setVerifying(null)}
        title={say(words.code.title, locale)}
        text={
          <p>
            {say(words.code.sentTo, locale)} <strong>{verifying?.email}</strong>. {say(words.code.lasts, locale)}
          </p>
        }
        onSubmit={async (code) => {
          const refusal = await saving.submit(() => verify(verifying!.requestId, code, verifying!.required), {
            success: say(words.common.saved, locale),
          });
          if (!refusal) setVerifying(null);
          return refusal;
        }}
        onResend={async () => {
          const answer = await add(verifying!.email);
          if (answer.status === "done") setVerifying({ ...verifying!, requestId: answer.requestId });
          else notify(explainRefusal(answer as { reason: string }, locale), "error");
        }}
      />
    </AccountCard>
  );
}
