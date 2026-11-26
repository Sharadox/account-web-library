"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { glideTo } from "@sharadox/scroll-web-library/glide";
import { accountAreaOfPath } from "@sharadox/account-web-library/account-area";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import styles from "./index.module.scss";
import type { AccountShellProperties } from "@sharadox/account-web-library/account-shell/type";

/** How long a jump holds its section in place while the page above it is still filling in. */
const HOLD_MILLISECONDS = 2_500;
/** The section being read is the last one whose top has passed this share of the screen's height. */
const READING_LINE = 0.3;

/** A click the browser should handle itself (a new tab or window). */
const ownClick = (event: MouseEvent) => event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

/** Where the page must be for a section to sit at the top, under the site's bar (its scroll margin). */
const topOf = (element: HTMLElement) =>
  element.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(element).scrollMarginTop) || 0);

/**
 * The account site as an application: the main areas across the top (Overview, Profile, Security, Notifications,
 * Privacy, Administration), and the open area as one page, its heading and its sections, with a side menu (sticky
 * beside them; across, on phones) that glides to each, even in the middle of another glide, and marks the one being
 * read as the page scrolls. Put it in a layout: it stays while only the area's page changes, so whatever is open
 * around it (the account menu, the bell) stays open.
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
  const content = useRef<HTMLDivElement>(null);
  const release = useRef<() => void>(() => {});
  // While a jump holds its section, the mark stays on it.
  const holding = useRef(false);
  useEffect(() => () => release.current(), []);

  // The section being read: the last whose top has passed the reading line (the last one at the bottom of the page).
  useEffect(() => {
    const list = keys ? keys.split(" ") : [];
    setCurrent(list[0]);
    if (list.length === 0) return;
    const hash = window.location.hash.slice(1);
    if (list.includes(hash)) {
      document.getElementById(hash)?.scrollIntoView({ block: "start" });
      setCurrent(hash);
    }
    let frame = 0;
    const read = () => {
      frame = 0;
      if (holding.current) return;
      const elements = list.map((id) => document.getElementById(id)).filter((element) => element !== null);
      const bottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      const passed = elements.filter(
        (element) => element.getBoundingClientRect().top <= window.innerHeight * READING_LINE,
      );
      const reading = bottom && window.scrollY > 0 ? elements.at(-1) : (passed.at(-1) ?? elements[0]);
      if (reading) setCurrent(reading.id);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [keys]);

  const jump = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (ownClick(event)) return;
    event.preventDefault();
    const element = document.getElementById(id);
    if (!element) return;
    // Through the page's smooth scrolling: a glide under way is taken over, never fought.
    glideTo(topOf(element));
    window.history.replaceState(null, "", `#${id}`);
    setCurrent(id);
    hold(element);
  };

  // Sections above may still be loading: as they fill in, the glide is aimed again at the jumped-to section, until
  // the reader scrolls or a moment passes.
  const hold = (element: HTMLElement) => {
    release.current();
    holding.current = true;
    const observer = new ResizeObserver(() => glideTo(topOf(element)));
    observer.observe(content.current!);
    const stop = () => {
      holding.current = false;
      observer.disconnect();
      clearTimeout(timer);
      for (const event of ["wheel", "touchstart", "keydown"]) window.removeEventListener(event, stop);
    };
    const timer = setTimeout(stop, HOLD_MILLISECONDS);
    for (const event of ["wheel", "touchstart", "keydown"]) window.addEventListener(event, stop, { passive: true });
    release.current = stop;
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
        <div key={key} ref={content} className={styles.content}>
          {open && <h1 className={styles.title}>{open.label}</h1>}
          {children}
        </div>
      </div>
    </div>
  );
}
