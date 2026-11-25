"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@sharadox/icon-web-library/icon";
import { classNames } from "@sharadox/web-library/class-name";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { Skeleton } from "@sharadox/account-web-library/skeleton";
import styles from "./index.module.scss";
import type { BellPage, NotificationBellProperties } from "@sharadox/account-web-library/notification-bell/type";

/** When something happened, in the reader's language and Portugal's time. */
export const noticeTime = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale === "pt" ? "pt-PT" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Lisbon",
  }).format(new Date(iso));

/** What a kind of notice says, in the reader's language (the kind itself when unknown). */
export function noticeText(kind: string, locale: NotificationBellProperties["locale"]): string {
  const words = (ACCOUNT_WORDS.notice as Record<string, { en: string; pt: string } | undefined>)[kind];
  return words ? say(words, locale) : kind;
}

/**
 * The bell beside the profile picture: a badge with how many notifications are unread, opening the latest (loaded
 * when it opens, with a skeleton meanwhile), each to mark as read or delete, "Mark all as read", and the inbox.
 *
 * @example
 * <NotificationBell locale="en" unread={2} load={load} markRead={markRead} remove={remove} inboxHref="/en/notifications/inbox" />
 */
export function NotificationBell({ locale, unread, load, markRead, remove, inboxHref }: NotificationBellProperties) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<BellPage | null>(null);
  const [count, setCount] = useState(unread);
  const panel = useId();
  const root = useRef<HTMLDivElement>(null);
  const words = ACCOUNT_WORDS.bell;

  useEffect(() => setCount(unread), [unread]);
  useEffect(() => {
    if (!open) return;
    let current = true;
    void load().then((loaded) => {
      if (!current) return;
      setPage(loaded);
      setCount(loaded.unread);
    });
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      current = false;
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open, load]);

  const read = async (ids?: string[]) => {
    await markRead(ids);
    const at = new Date().toISOString();
    setPage(
      (shown) =>
        shown && {
          unread: ids ? Math.max(0, shown.unread - ids.length) : 0,
          notifications: shown.notifications.map((notification) =>
            !ids || ids.includes(notification.id)
              ? { ...notification, readAt: notification.readAt ?? at }
              : notification,
          ),
        },
    );
    setCount((before) => (ids ? Math.max(0, before - ids.length) : 0));
  };

  const drop = async (id: string, wasUnread: boolean) => {
    await remove(id);
    setPage(
      (shown) =>
        shown && { ...shown, notifications: shown.notifications.filter((notification) => notification.id !== id) },
    );
    if (wasUnread) setCount((before) => Math.max(0, before - 1));
  };

  return (
    <div ref={root} className={styles.root}>
      <button
        type="button"
        className={styles.bell}
        aria-expanded={open}
        aria-controls={panel}
        aria-label={
          count > 0 ? `${say(words.open, locale)}, ${count} ${say(words.unread, locale)}` : say(words.open, locale)
        }
        onClick={() => setOpen(!open)}
      >
        <Icon name="bell" />
        {count > 0 && <span className={styles.badge}>{count > 99 ? "99+" : count}</span>}
      </button>
      {open && (
        <div id={panel} className={styles.panel}>
          <div className={styles.top}>
            <p className={styles.heading}>{say(words.open, locale)}</p>
            {count > 0 && (
              <button type="button" className={styles.link} onClick={() => void read()}>
                {say(words.markAll, locale)}
              </button>
            )}
          </div>
          {!page ? (
            <Skeleton label={say(ACCOUNT_WORDS.common.loading, locale)} lines={3} />
          ) : page.notifications.length === 0 ? (
            <p className={styles.empty}>{say(words.empty, locale)}</p>
          ) : (
            <ul className={styles.list}>
              {page.notifications.map((notification) => (
                <li key={notification.id} className={classNames(styles.item, !notification.readAt && styles.unread)}>
                  <span className={styles.text}>
                    <span>{noticeText(notification.kind, locale)}</span>
                    <time dateTime={notification.createdAt}>{noticeTime(notification.createdAt, locale)}</time>
                  </span>
                  {!notification.readAt && (
                    <button
                      type="button"
                      className={styles.action}
                      aria-label={say(words.markRead, locale)}
                      onClick={() => void read([notification.id])}
                    >
                      <Icon name="check" />
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.action}
                    aria-label={say(ACCOUNT_WORDS.common.delete, locale)}
                    onClick={() => void drop(notification.id, !notification.readAt)}
                  >
                    <Icon name="trash" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link href={inboxHref} className={styles.all} onClick={() => setOpen(false)}>
            {say(words.all, locale)}
          </Link>
        </div>
      )}
    </div>
  );
}
