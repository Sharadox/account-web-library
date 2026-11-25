"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "@sharadox/icon-web-library/icon";
import { AccountAvatar } from "@sharadox/account-web-library/account-avatar";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import styles from "./index.module.scss";
import type { AccountMenuProperties, MenuAccount } from "@sharadox/account-web-library/account-menu/type";

/** An account's picture, name and identifier on one line. */
function Who({ account, size }: { account: MenuAccount; size: number }) {
  return (
    <>
      <AccountAvatar name={account.name} pictureUrl={account.pictureUrl} size={size} />
      <span className={styles.names}>
        <strong>{account.name}</strong>
        <span>@{account.identifier}</span>
      </span>
    </>
  );
}

/** A menu button that sends its form, with a loader while it's sent (the menu stays open until it's done). */
function SendButton({ className, children }: { className: string | undefined; children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending || undefined}>
      {children}
      {pending && <span className={styles.spinner} aria-hidden="true" />}
    </button>
  );
}

/**
 * The signed-in account's picture in the site's bar, opening its menu: who is signed in with their roles as chips,
 * the account settings and the administration (for administrators), then:
 * - with one account on this browser, "Add another account" and "Sign out";
 * - with more, "Switch account", which turns the menu into the list of every account (a Back button returns), and
 *   "Sign out of all accounts" too.
 * Switching and signing out are forms posting to server actions: the menu stays open with a loader on the choice
 * until it's done, and the page stays where it was. Escape, a click outside or a choice closes it.
 *
 * @example
 * <AccountMenu locale={locale} {...signedIn} />
 */
export function AccountMenu({
  locale,
  current,
  others,
  signInHref,
  settingsHref,
  administrationHref,
  switchAccount,
  signOut,
}: AccountMenuProperties) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const panel = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const words = ACCOUNT_WORDS.menu;
  const close = () => {
    setOpen(false);
    setSwitching(false);
  };
  /** Runs a menu form's server action, then closes the menu. */
  const send = (action: (form: FormData) => Promise<void>) => async (form: FormData) => {
    await action(form);
    close();
  };

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const several = others.length > 0;
  return (
    <div ref={root} className={styles.root}>
      <button
        ref={button}
        type="button"
        className={styles.button}
        aria-expanded={open}
        aria-controls={panel}
        aria-label={`${say(words.open, locale)}: ${current.name}`}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <AccountAvatar name={current.name} pictureUrl={current.pictureUrl} />
      </button>
      {open && (
        <div id={panel} className={styles.panel}>
          {switching ? (
            <>
              <button type="button" className={styles.back} onClick={() => setSwitching(false)}>
                <Icon name="chevron-left" />
                {say(ACCOUNT_WORDS.common.back, locale)}
              </button>
              <p className={styles.heading}>{say(words.switch, locale)}</p>
              <div className={styles.account} aria-current="true">
                <Who account={current} size={30} />
                <Icon name="check" />
              </div>
              {others.map((account) => (
                <form key={account.accountId} action={send(switchAccount)}>
                  <input type="hidden" name="account" value={account.accountId} />
                  <SendButton className={styles.account}>
                    <Who account={account} size={30} />
                  </SendButton>
                </form>
              ))}
              <Link href={signInHref} className={styles.item} onClick={close}>
                <Icon name="plus" />
                {say(words.add, locale)}
              </Link>
            </>
          ) : (
            <>
              <div className={styles.who}>
                <Who account={current} size={44} />
              </div>
              {current.roles.length > 0 && (
                <ul className={styles.chips} aria-label={say(words.roles, locale)}>
                  {current.roles.map((role) => (
                    <li key={role}>{role}</li>
                  ))}
                </ul>
              )}
              <Link href={settingsHref} className={styles.item} onClick={close}>
                <Icon name="settings" />
                {say(words.settings, locale)}
              </Link>
              {administrationHref && (
                <Link href={administrationHref} className={styles.item} onClick={close}>
                  <Icon name="shield" />
                  {say(words.administration, locale)}
                </Link>
              )}
              <div className={styles.group}>
                {several ? (
                  <button type="button" className={styles.item} onClick={() => setSwitching(true)}>
                    <Icon name="switch" />
                    {say(words.switch, locale)}
                    <Icon name="chevron-right" className={styles.after} />
                  </button>
                ) : (
                  <Link href={signInHref} className={styles.item} onClick={close}>
                    <Icon name="plus" />
                    {say(words.add, locale)}
                  </Link>
                )}
                <form action={send(signOut)}>
                  <input type="hidden" name="account" value={current.accountId} />
                  <SendButton className={styles.item}>
                    <Icon name="sign-out" />
                    {say(words.signOut, locale)}
                  </SendButton>
                </form>
                {several && (
                  <form action={send(signOut)}>
                    <input type="hidden" name="account" value="" />
                    <SendButton className={styles.item}>
                      <Icon name="sign-out" />
                      {say(words.signOutAll, locale)}
                    </SendButton>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
