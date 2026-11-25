"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { accountAreaOfPath } from "@sharadox/account-web-library/account-area";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import styles from "./index.module.scss";
import type { AccountShellProperties } from "@sharadox/account-web-library/account-shell/type";

/** A click the browser should handle itself (a new tab or window). */
const ownClick = (event: MouseEvent) => event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

/**
 * The account site as an application: the main areas across the top (Overview, Profile, Security, Notifications,
 * Privacy, Administration), and the open area as one page, its heading and its sections, with a side menu (across, on
 * phones) that jumps to each and marks the one being read. Put it in a layout: it stays while only the area's page
 * changes, so whatever is open around it (the account menu, the bell) stays open.
 *
 * @example
 * <AccountShell locale="en" areas={accountAreas({ locale, administrator })}>{children}</AccountShell>
 */
export function AccountShell({ locale, areas, children }: AccountShellProperties) {
  const key = accountAreaOfPath(usePathname());
  const open = areas.find((area) => area.key === key);
  const sections = open && open.sections.length > 1 ? open.sections : [];
  const [current, setCurrent] = useState<string | undefined>(sections[0]?.key);
  const keys = sections.map((section) => section.key).join(" ");

  // The section being read: the highest one on screen.
  useEffect(() => {
    const list = keys ? keys.split(" ") : [];
    setCurrent(list[0]);
    const elements = list.map((id) => document.getElementById(id)).filter((element) => element !== null);
    const hash = window.location.hash.slice(1);
    if (list.includes(hash)) {
      document.getElementById(hash)?.scrollIntoView({ block: "start" });
      setCurrent(hash);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setCurrent(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [keys]);

  const jump = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (ownClick(event)) return;
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    setCurrent(id);
  };

  return (
    <div className={styles.shell}>
      <nav className={styles.areas} aria-label={say(ACCOUNT_WORDS.area.main, locale)}>
        <ul>
          {areas.map((area) => (
            <li key={area.key}>
              <Link href={area.href} aria-current={area.key === key ? "page" : undefined}>
                {area.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.body} data-sections={sections.length > 0 || undefined}>
        {sections.length > 0 && (
          <nav className={styles.sections} aria-label={say(ACCOUNT_WORDS.area.sections, locale)}>
            <ul>
              {sections.map((section) => (
                <li key={section.key}>
                  <a
                    href={section.href}
                    aria-current={section.key === current ? "true" : undefined}
                    onClick={(event) => jump(event, section.key)}
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className={styles.content}>
          {open && <h1 className={styles.title}>{open.label}</h1>}
          {children}
        </div>
      </div>
    </div>
  );
}
