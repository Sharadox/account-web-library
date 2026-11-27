"use client";
import Link from "next/link";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { Card } from "@sharadox/interface-web-library/card";
import { formatAccountTime } from "@sharadox/account-web-library/account-time";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { EditablePanel } from "@sharadox/account-web-library/editable-field";
import { SkeletonValue } from "@sharadox/interface-web-library/skeleton-value";
import styles from "./index.module.scss";
import type { BanPanelProperties } from "@sharadox/account-web-library/ban-panel/type";

/**
 * The account's bans, or a thank-you without any: for each, whether it's active and until when, the statement of
 * reasons, the rules it broke (linked to the public rules), and its one appeal: Appeal shows the text with Save and
 * Cancel; then its decision.
 *
 * @example
 * <BanPanel locale="en" bans={bans} rulesHref="/en/rules" appeal={appeal} />
 */
export function BanPanel({ locale, bans, rulesHref, appeal }: BanPanelProperties) {
  const { submit } = useAccountAction();
  const words = ACCOUNT_WORDS.privacy;
  if (!bans)
    return (
      <Card>
        <p className={styles.state}>
          <SkeletonValue width="20ch" label={say(ACCOUNT_WORDS.common.loading, locale)} />
        </p>
        <p className={styles.statement}>
          <SkeletonValue width="40ch" />
        </p>
      </Card>
    );
  if (bans.length === 0)
    return (
      <Card>
        <p className={styles.none}>{say(words.noBans, locale)}</p>
      </Card>
    );
  return (
    <>
      {bans.map((ban) => (
        <Card key={ban.banId} tone={ban.active ? "danger" : undefined}>
          <p className={styles.state}>
            <strong>{say(ban.active ? words.active : words.ended, locale)}</strong>
            {" · "}
            {ban.endsAt
              ? `${say(words.until, locale)} ${formatAccountTime(ban.endsAt, locale)}`
              : say(words.permanent, locale)}
          </p>
          <p className={styles.statement}>{ban.statement}</p>
          <p className={styles.rules}>
            {say(words.brokeRules, locale)}:{" "}
            {ban.rules.map((rule, index) => (
              <span key={rule}>
                {index > 0 && ", "}
                <Link href={`${rulesHref}#${rule}`}>{rule}</Link>
              </span>
            ))}
          </p>
          {ban.appeal ? (
            <p className={styles.appeal}>
              {ban.appeal.decision ? (
                <>
                  <strong>{say(words[ban.appeal.decision], locale)}</strong>
                  {ban.appeal.reasons && `: ${ban.appeal.reasons}`}
                </>
              ) : (
                say(words.appealed, locale)
              )}
            </p>
          ) : (
            <EditablePanel
              locale={locale}
              label={say(words.appeal, locale)}
              view={null}
              editLabel={say(words.appeal, locale)}
              fields={
                <label className={styles.field}>
                  <span>{say(words.appealText, locale)}</span>
                  <textarea name="text" rows={5} maxLength={5000} autoFocus />
                </label>
              }
              onSave={async (form) => {
                const text = String(form.get("text")).trim();
                if (!text) return say(ACCOUNT_WORDS.error.generic, locale);
                return submit(() => appeal(ban.banId, text));
              }}
            />
          )}
        </Card>
      ))}
    </>
  );
}
