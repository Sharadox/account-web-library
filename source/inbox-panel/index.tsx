"use client";
import { useEffect, useState } from "react";
import { Icon } from "@sharadox/icon-web-library/icon";
import { classNames } from "@sharadox/web-library/class-name";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { Button } from "@sharadox/interface-web-library/button";
import { Card } from "@sharadox/interface-web-library/card";
import { formatAccountTime } from "@sharadox/account-web-library/account-time";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { noticeText } from "@sharadox/account-web-library/notification-bell";
import styles from "./index.module.scss";
import type { InboxPanelProperties } from "@sharadox/account-web-library/inbox-panel/type";

/**
 * Every notification of the account, newest first, unread ones marked: each to mark as read or delete, "Mark all as
 * read", and "Show more" for older ones. Marking read and deleting show at once, and go back if refused.
 *
 * @example
 * <InboxPanel locale="en" {...page} loadMore={loadMore} markRead={markRead} remove={remove} />
 */
export function InboxPanel({ locale, notifications, unread, more, loadMore, markRead, remove }: InboxPanelProperties) {
  const [shown, setShown] = useState(notifications);
  const [left, setLeft] = useState(more);
  const [loading, setLoading] = useState(false);
  const { run } = useAccountAction();
  // Read or deleted here before the page knows: undone if the server refuses.
  const [allRead, setAllRead] = useState(false);
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const without = (set: ReadonlySet<string>, id: string) => new Set([...set].filter((one) => one !== id));
  const isRead = (notification: (typeof shown)[number]) =>
    Boolean(notification.readAt) || allRead || read.has(notification.id);
  const visible = shown.filter(({ id }) => !gone.has(id));
  const markAll = async () => {
    setAllRead(true);
    if (!(await run(() => markRead()))) setAllRead(false);
  };
  const markOne = async (id: string) => {
    setRead((now) => new Set([...now, id]));
    if (!(await run(() => markRead([id])))) setRead((now) => without(now, id));
  };
  const drop = async (id: string) => {
    setGone((now) => new Set([...now, id]));
    if (!(await run(() => remove(id)))) setGone((now) => without(now, id));
  };
  const words = ACCOUNT_WORDS;
  useEffect(() => {
    setShown(notifications);
    setLeft(more);
  }, [notifications, more]);

  return (
    <Card>
      {unread > 0 && !allRead && (
        <Button look="quiet" icon="check" onClick={() => void markAll()} className={styles.all}>
          {say(words.bell.markAll, locale)}
        </Button>
      )}
      {visible.length === 0 ? (
        <p className={styles.empty}>{say(words.bell.empty, locale)}</p>
      ) : (
        <ul className={styles.list}>
          {visible.map((notification) => (
            <li key={notification.id} className={classNames(styles.item, !isRead(notification) && styles.unread)}>
              <span className={styles.text}>
                <span>{noticeText(notification.kind, locale)}</span>
                <time dateTime={notification.createdAt}>{formatAccountTime(notification.createdAt, locale)}</time>
              </span>
              {!isRead(notification) && (
                <button
                  type="button"
                  className={styles.action}
                  aria-label={say(words.bell.markRead, locale)}
                  onClick={() => void markOne(notification.id)}
                >
                  <Icon name="check" />
                </button>
              )}
              <button
                type="button"
                className={styles.action}
                aria-label={say(words.common.delete, locale)}
                onClick={() => void drop(notification.id)}
              >
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {left && (
        <Button
          look="plain"
          pending={loading}
          className={styles.more}
          onClick={async () => {
            setLoading(true);
            const page = await loadMore(shown.at(-1)!.id);
            setShown((all) => [...all, ...page.notifications]);
            setLeft(page.more);
            setLoading(false);
          }}
        >
          {say(words.common.more, locale)}
        </Button>
      )}
    </Card>
  );
}
