import { Icon } from "@sharadox/icon-web-library/icon";
import { AccountCard } from "@sharadox/account-web-library/account-card";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import styles from "./index.module.scss";
import type { DownloadPanelProperties } from "@sharadox/account-web-library/download-panel/type";

/**
 * Downloading everything kept about the account, in one JSON file (a plain link: the browser saves the file).
 *
 * @example
 * <DownloadPanel locale="en" href="/en/settings/export" />
 */
export function DownloadPanel({ locale, href }: DownloadPanelProperties) {
  return (
    <AccountCard description={say(ACCOUNT_WORDS.privacy.downloadText, locale)}>
      {/* A plain anchor: a file to save, not a page to open. */}
      <a href={href} download className={styles.link}>
        <Icon name="download" />
        {say(ACCOUNT_WORDS.privacy.download, locale)}
      </a>
    </AccountCard>
  );
}
