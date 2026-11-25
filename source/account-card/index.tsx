import { classNames } from "@sharadox/web-library/class-name";
import styles from "./index.module.scss";
import type { AccountCardProperties } from "@sharadox/account-web-library/account-card/type";

/**
 * A card of the account screens: an optional heading and description over its content, outlined in red for what
 * can't be undone.
 *
 * @example
 * <AccountCard title="Emails" description="Where codes go.">…</AccountCard>
 */
export function AccountCard({ title, description, tone, children }: AccountCardProperties) {
  return (
    <div className={classNames(styles.card, tone && styles[tone])}>
      {title && <h2 className={styles.title}>{title}</h2>}
      {description && <div className={styles.description}>{description}</div>}
      {children}
    </div>
  );
}
