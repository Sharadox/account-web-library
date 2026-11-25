import styles from "./index.module.scss";
import type { AccountSectionProperties } from "@sharadox/account-web-library/account-section/type";

/**
 * One section of an area's page, the place its side menu jumps to: a heading, an optional line under it, and its
 * content. It stops below the site's fixed bar when jumped to.
 *
 * @example
 * <AccountSection id="devices" title="Devices"><DevicePanel … /></AccountSection>
 */
export function AccountSection({ id, title, description, hideTitle, children }: AccountSectionProperties) {
  const titleId = `${id}-title`;
  return (
    <section
      id={id}
      className={styles.section}
      {...(hideTitle ? { "aria-label": title } : { "aria-labelledby": titleId })}
    >
      {!hideTitle && (
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {description && <div className={styles.description}>{description}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
