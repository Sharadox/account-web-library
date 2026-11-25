import { AccountCard } from "@sharadox/account-web-library/account-card";
import { formatAccountTime } from "@sharadox/account-web-library/account-time";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import styles from "./index.module.scss";
import type { BanAdministrationProperties } from "@sharadox/account-web-library/ban-administration/type";

/**
 * Everyone banned now: who, where, the rules broken, the statement and until when.
 *
 * @example
 * <BanAdministration locale="en" bans={bans} />
 */
export function BanAdministration({ locale, bans }: BanAdministrationProperties) {
  const words = ACCOUNT_WORDS;
  return (
    <AccountCard>
      {bans.length === 0 ? (
        <p className={styles.muted}>{say(words.administration.noActiveBans, locale)}</p>
      ) : (
        <ul className={styles.list}>
          {bans.map((ban) => (
            <li key={ban.banId} className={styles.row}>
              <strong>@{ban.identifier}</strong>
              <span className={styles.muted}>
                {ban.application ?? say(words.administration.everywhere, locale)} · {ban.rules.join(", ")} ·{" "}
                {ban.endsAt
                  ? `${say(words.privacy.until, locale)} ${formatAccountTime(ban.endsAt, locale)}`
                  : say(words.privacy.permanent, locale)}
              </span>
              <span>{ban.statement}</span>
            </li>
          ))}
        </ul>
      )}
    </AccountCard>
  );
}
