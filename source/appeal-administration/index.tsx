"use client";
import { useState, type FormEvent } from "react";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { Button } from "@sharadox/interface-web-library/button";
import { Card } from "@sharadox/interface-web-library/card";
import { formatAccountTime } from "@sharadox/account-web-library/account-time";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { SkeletonValue } from "@sharadox/interface-web-library/skeleton-value";
import styles from "./index.module.scss";
import type { AppealAdministrationProperties } from "@sharadox/account-web-library/appeal-administration/type";

const DECISIONS = ["upheld", "shortened", "lifted"] as const;

/**
 * The appeals waiting: who, the ban's statement, their text, and the decision with its reasons (the account sees
 * them): keep the ban, shorten it to a date, or lift it.
 *
 * @example
 * <AppealAdministration locale="en" appeals={appeals} decide={decide} />
 */
export function AppealAdministration({ locale, appeals, decide }: AppealAdministrationProperties) {
  const { run } = useAccountAction();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const words = ACCOUNT_WORDS.administration;

  const submit = (appealId: string) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const decision = (event.nativeEvent as SubmitEvent).submitter!.getAttribute("value") as (typeof DECISIONS)[number];
    const reasons = String(form.get("reasons")).trim();
    if (!reasons) return setErrors({ ...errors, [appealId]: say(ACCOUNT_WORDS.error.generic, locale) });
    const endsAt = String(form.get("endsAt"));
    void run(() => decide({ appealId, decision, reasons, ...(decision === "shortened" && endsAt ? { endsAt } : {}) }), {
      success: say(ACCOUNT_WORDS.common.done, locale),
    });
  };

  if (!appeals)
    return (
      <Card>
        <p className={styles.who}>
          <SkeletonValue width="20ch" label={say(ACCOUNT_WORDS.common.loading, locale)} />
        </p>
        <p className={styles.muted}>
          <SkeletonValue width="36ch" />
        </p>
      </Card>
    );
  if (appeals.length === 0)
    return (
      <Card>
        <p className={styles.muted}>{say(words.noAppeals, locale)}</p>
      </Card>
    );
  return (
    <>
      {appeals.map((appeal) => (
        <Card key={appeal.appealId}>
          <p className={styles.who}>
            <strong>@{appeal.identifier}</strong> · {formatAccountTime(appeal.createdAt, locale)}
          </p>
          <p className={styles.muted}>{appeal.statement}</p>
          <blockquote className={styles.quote}>{appeal.text}</blockquote>
          <form className={styles.form} onSubmit={submit(appeal.appealId)} noValidate>
            <label className={styles.field}>
              <span>{say(words.reasons, locale)}</span>
              <textarea name="reasons" rows={3} maxLength={5000} />
            </label>
            <label className={styles.field}>
              <span>{say(words.shortenTo, locale)}</span>
              <input name="endsAt" type="date" />
            </label>
            {errors[appeal.appealId] && (
              <p className={styles.error} role="alert">
                {errors[appeal.appealId]}
              </p>
            )}
            <div className={styles.buttons}>
              {DECISIONS.map((decision) => (
                <Button
                  key={decision}
                  type="submit"
                  value={decision}
                  look={decision === "lifted" ? "primary" : "secondary"}
                >
                  {say(words[decision], locale)}
                </Button>
              ))}
            </div>
          </form>
        </Card>
      ))}
    </>
  );
}
