import Link from "next/link";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import styles from "./index.module.scss";
import type { AccountShellProperties } from "@sharadox/account-web-library/account-shell/type";

/**
 * The account site as an application: the main areas across the top (Overview, Profile, Security, Notifications,
 * Privacy, Administration), the open area's sections down the side (across, scrolling, on phones), and the section
 * itself. Plain links, so every section is its own address and opens at once.
 *
 * @example
 * <AccountShell locale="en" areas={accountAreas({ locale, administrator })} area="security" section="devices">…</AccountShell>
 */
export function AccountShell({ locale, areas, area, section, title, description, children }: AccountShellProperties) {
  const open = areas.find(({ key }) => key === area);
  const current = open?.sections.find(({ key }) => key === section);
  return (
    <div className={styles.shell}>
      <nav className={styles.areas} aria-label={say(ACCOUNT_WORDS.area.main, locale)}>
        <ul>
          {areas.map(({ key, label, href }) => (
            <li key={key}>
              <Link href={href} aria-current={key === area ? "page" : undefined}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.body}>
        {open && open.sections.length > 1 && (
          <nav className={styles.sections} aria-label={say(ACCOUNT_WORDS.area.sections, locale)}>
            <ul>
              {open.sections.map(({ key, label, href }) => (
                <li key={key}>
                  <Link href={href} aria-current={key === section ? "page" : undefined}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <section className={styles.content} aria-labelledby="account-section-title">
          <header className={styles.header}>
            <h1 id="account-section-title" className={styles.title}>
              {title ?? (open && open.sections.length > 1 ? current?.label : undefined) ?? open?.label}
            </h1>
            {description && <p className={styles.description}>{description}</p>}
          </header>
          {children}
        </section>
      </div>
    </div>
  );
}
