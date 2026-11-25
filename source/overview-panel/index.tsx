import Link from "next/link";
import { Icon } from "@sharadox/icon-web-library/icon";
import type { IconName } from "@sharadox/icon-web-library/icon/type";
import { accountSectionPath } from "@sharadox/account-web-library/account-area";
import { AccountAvatar } from "@sharadox/account-web-library/account-avatar";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import type { Words } from "@sharadox/account-web-library/account-words/type";
import styles from "./index.module.scss";
import type { OverviewPanelProperties } from "@sharadox/account-web-library/overview-panel/type";

/**
 * The account at a glance: who it is (with a way to edit the profile), then a card per area with its key number
 * (ways to sign in and how many are required, devices signed in, unread notifications, the data download), each
 * leading to its section. Two cards a row on wide screens, one on phones.
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
  const counted = (count: number, one: Words, many: Words) => say(count === 1 ? one : many, locale);
  const cards: { icon: IconName; title: string; value?: number; detail: string; href: string }[] = [
    {
      icon: "key",
      title: say(words.section.methods, locale),
      value: methods,
      detail: `${counted(methods, words.overview.method, words.overview.methods)} · ${required} ${say(words.overview.required, locale)}`,
      href: accountSectionPath(locale, "security", "methods"),
    },
    {
      icon: "device",
      title: say(words.section.devices, locale),
      value: devices,
      detail: say(words.overview.devices, locale),
      href: accountSectionPath(locale, "security", "devices"),
    },
    {
      icon: "bell",
      title: say(words.section.inbox, locale),
      value: unread,
      detail: say(words.overview.unread, locale),
      href: accountSectionPath(locale, "notifications", "inbox"),
    },
    {
      icon: "download",
      title: say(words.section.download, locale),
      detail: say(words.privacy.downloadText, locale),
      href: accountSectionPath(locale, "privacy", "download"),
    },
  ];
  return (
    <div className={styles.overview}>
      <div className={styles.who}>
        <AccountAvatar name={name} pictureUrl={pictureUrl} size={72} />
        <div className={styles.names}>
          <span className={styles.hello}>{say(words.overview.hello, locale)}</span>
          <h2 className={styles.name}>{name}</h2>
          <span className={styles.identifier}>@{identifier}</span>
        </div>
        <Link href={accountSectionPath(locale, "profile", "identity")} className={styles.edit}>
          <Icon name="pencil" />
          <span>{say(words.overview.editProfile, locale)}</span>
        </Link>
      </div>
      <ul className={styles.cards}>
        {cards.map((card) => (
          <li key={card.href}>
            <Link href={card.href} className={styles.card}>
              <span className={styles.icon} aria-hidden="true">
                <Icon name={card.icon} />
              </span>
              <span className={styles.title}>{card.title}</span>
              <span className={styles.detail}>
                {card.value !== undefined && <strong className={styles.value}>{card.value}</strong>} {card.detail}
              </span>
              <Icon name="chevron-right" className={styles.arrow} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
