import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@sharadox/icon-web-library/icon";
import type { IconName } from "@sharadox/icon-web-library/icon/type";
import { SkeletonValue } from "@sharadox/interface-web-library/skeleton-value";
import { accountSectionPath } from "@sharadox/account-web-library/account-area";
import { AccountAvatar } from "@sharadox/account-web-library/account-avatar";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { TimeGreeting } from "@sharadox/account-web-library/time-greeting";
import styles from "./index.module.scss";
import type { OverviewPanelProperties } from "@sharadox/account-web-library/overview-panel/type";

/**
 * The account at a glance: who it is, greeted by the visitor's time of day (with a way to edit the profile), then a
 * card per area with its key numbers (ways in and how many are required, devices signed in, unread notifications, the
 * data download), each leading to its section. The cards and their words show at once; only what is still on its way
 * (the picture, the name, the numbers) shows as a skeleton.
 *
 * @example
 * <OverviewPanel locale="en" who={{ name: "Ana", identifier: "ana", pictureUrl: null }} counts={counts} />
 */
export function OverviewPanel({ locale, who, counts }: OverviewPanelProperties) {
  const words = ACCOUNT_WORDS;
  const loading = say(words.common.loading, locale);
  const number = (value: number | undefined) =>
    value === undefined ? (
      <SkeletonValue width="1.5ch" label={loading} />
    ) : (
      <strong className={styles.value}>{value}</strong>
    );
  const cards: { icon: IconName; title: string; detail: ReactNode; href: string }[] = [
    {
      icon: "key",
      title: say(words.section.methods, locale),
      detail: (
        <>
          <span className={styles.figure}>
            {number(counts?.methods)}{" "}
            {say(counts?.methods === 1 ? words.overview.method : words.overview.methods, locale)}
          </span>
          <span className={styles.figure}>
            {number(counts?.required)} {say(words.overview.required, locale)}
          </span>
        </>
      ),
      href: accountSectionPath(locale, "security", "methods"),
    },
    {
      icon: "device",
      title: say(words.section.devices, locale),
      detail: (
        <span className={styles.figure}>
          {number(counts?.devices)} {say(words.overview.devices, locale)}
        </span>
      ),
      href: accountSectionPath(locale, "security", "devices"),
    },
    {
      icon: "bell",
      title: say(words.section.inbox, locale),
      detail: (
        <span className={styles.figure}>
          {number(counts?.unread)} {say(words.overview.unread, locale)}
        </span>
      ),
      href: accountSectionPath(locale, "notifications", "inbox"),
    },
    {
      icon: "download",
      title: say(words.section.download, locale),
      detail: <span className={styles.text}>{say(words.privacy.downloadText, locale)}</span>,
      href: accountSectionPath(locale, "privacy", "download"),
    },
  ];
  return (
    <div className={styles.overview}>
      <div className={styles.who}>
        {who ? <AccountAvatar name={who.name} pictureUrl={who.pictureUrl} size={72} /> : <SkeletonValue circle={72} />}
        <div className={styles.names}>
          <TimeGreeting locale={locale} className={styles.hello} />
          <h2 className={styles.name}>{who ? who.name : <SkeletonValue width="10ch" label={loading} />}</h2>
          <span className={styles.identifier}>{who ? `@${who.identifier}` : <SkeletonValue width="8ch" />}</span>
        </div>
        <Link href={accountSectionPath(locale, "profile", "name")} className={styles.edit}>
          <Icon name="pencil" />
          <span>{say(words.overview.editProfile, locale)}</span>
        </Link>
      </div>
      <div className={styles.cards}>
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className={styles.card}>
            <span className={styles.icon} aria-hidden="true">
              <Icon name={card.icon} />
            </span>
            <span className={styles.body}>
              <span className={styles.title}>{card.title}</span>
              <span className={styles.detail}>{card.detail}</span>
            </span>
            <Icon name="chevron-right" className={styles.arrow} />
          </Link>
        ))}
      </div>
    </div>
  );
}
