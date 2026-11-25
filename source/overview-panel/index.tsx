import Link from "next/link";
import { Icon } from "@sharadox/icon-web-library/icon";
import type { IconName } from "@sharadox/icon-web-library/icon/type";
import { accountSectionPath } from "@sharadox/account-web-library/account-area";
import { AccountAvatar } from "@sharadox/account-web-library/account-avatar";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import styles from "./index.module.scss";
import type { OverviewPanelProperties } from "@sharadox/account-web-library/overview-panel/type";

/**
 * The account at a glance: who it is, then a card per area with its key number (ways to sign in and how many are
 * required, devices signed in, unread notifications), each opening its section.
 *
 * @example
 * <OverviewPanel locale="en" name="Ana" identifier="ana" pictureUrl={null} methods={2} required={1} devices={3} unread={0} />
 */
export function OverviewPanel({
  locale,
  name,
  identifier,
  pictureUrl,
  methods,
  required,
  devices,
  unread,
}: OverviewPanelProperties) {
  const words = ACCOUNT_WORDS;
  const cards: { icon: IconName; title: string; value: string; href: string }[] = [
    {
      icon: "key",
      title: say(words.section.methods, locale),
      value: `${methods} ${say(words.overview.methods, locale)} · ${required} ${say(words.overview.required, locale)}`,
      href: accountSectionPath(locale, "security", "methods"),
    },
    {
      icon: "device",
      title: say(words.section.devices, locale),
      value: `${devices} ${say(words.overview.devices, locale)}`,
      href: accountSectionPath(locale, "security", "devices"),
    },
    {
      icon: "bell",
      title: say(words.section.inbox, locale),
      value: `${unread} ${say(words.overview.unread, locale)}`,
      href: accountSectionPath(locale, "notifications", "inbox"),
    },
    {
      icon: "lock",
      title: say(words.area.privacy, locale),
      value: say(words.section.download, locale),
      href: accountSectionPath(locale, "privacy", "download"),
    },
  ];
  return (
    <div className={styles.overview}>
      <Link href={accountSectionPath(locale, "profile", "identity")} className={styles.who}>
        <AccountAvatar name={name} pictureUrl={pictureUrl} size={64} />
        <span>
          <span className={styles.hello}>{say(words.overview.hello, locale)}</span>
          <strong>{name}</strong>
          <span>@{identifier}</span>
        </span>
      </Link>
      <ul className={styles.cards}>
        {cards.map((card) => (
          <li key={card.href}>
            <Link href={card.href} className={styles.card}>
              <Icon name={card.icon} />
              <span>
                <strong>{card.title}</strong>
                <span>{card.value}</span>
              </span>
              <Icon name="chevron-right" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
