import Link from "next/link";
import { Card } from "@sharadox/interface-web-library/card";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import styles from "./index.module.scss";
import type { RuleAdministrationProperties } from "@sharadox/account-web-library/rule-administration/type";

/**
 * The rules in force (from the configuration; public), each with where it applies and its penalties for a first,
 * second and later breach, and a link to the public page.
 *
 * @example
 * <RuleAdministration locale="en" rules={rules} rulesHref="/en/rules" />
 */
export function RuleAdministration({ locale, rules, rulesHref }: RuleAdministrationProperties) {
  const words = ACCOUNT_WORDS.administration;
  return (
    <Card description={say(words.rulesText, locale)}>
      {rules.length === 0 ? (
        <p className={styles.muted}>{say(words.noRules, locale)}</p>
      ) : (
        <ul className={styles.list}>
          {rules.map((rule) => (
            <li key={`${rule.application}-${rule.code}`} className={styles.row}>
              <strong>{rule.title}</strong>
              <span className={styles.muted}>
                {rule.code} · {rule.application ?? say(words.everywhere, locale)} · {rule.penalties.join(" → ")}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link href={rulesHref} className={styles.link}>
        {say(words.publicRules, locale)}
      </Link>
    </Card>
  );
}
