import { Card } from "@sharadox/interface-web-library/card";
import { formatAccountTime } from "@sharadox/account-web-library/account-time";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import type { Words } from "@sharadox/account-web-library/account-words/type";
import styles from "./index.module.scss";
import type { ActivityPanelProperties } from "@sharadox/account-web-library/activity-panel/type";

/** What an audit action says, in the reader's language (the action itself when it has no words). */
export function activityText(action: string, locale: ActivityPanelProperties["locale"]): string {
  const words = (ACCOUNT_WORDS.activity as Record<string, Words | undefined>)[action];
  return words ? say(words, locale) : action;
}

/**
 * What happened on the account over the last year, newest first, in a list that scrolls on its own (with the
 * account screens' scrollbar).
 *
 * @example
 * <ActivityPanel locale="en" activity={activity} />
 */
export function ActivityPanel({ locale, activity }: ActivityPanelProperties) {
  return (
    <Card>
      {activity.length === 0 ? (
        <p className={styles.empty}>{say(ACCOUNT_WORDS.activity.empty, locale)}</p>
      ) : (
        <ol className={styles.list} tabIndex={0} aria-label={say(ACCOUNT_WORDS.section.activity, locale)}>
          {activity.map(({ id, at, action }) => (
            <li key={id} className={styles.item}>
              <span>{activityText(action, locale)}</span>
              <time dateTime={at}>{formatAccountTime(at, locale)}</time>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
