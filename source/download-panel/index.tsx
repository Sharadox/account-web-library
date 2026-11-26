"use client";
import { useState, type MouseEvent } from "react";
import { Icon } from "@sharadox/icon-web-library/icon";
import { Card } from "@sharadox/interface-web-library/card";
import { useToast } from "@sharadox/interface-web-library/toast";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import styles from "./index.module.scss";
import type { DownloadPanelProperties } from "@sharadox/account-web-library/download-panel/type";

/** The file name a response gives in its Content-Disposition, if any. */
const fileName = (response: Response) =>
  /filename="?([^";]+)"?/.exec(response.headers.get("content-disposition") ?? "")?.[1];

/**
 * Downloading everything kept about the account, in one JSON file. The link fetches the file itself, with a loader
 * on it until the browser has the file (without JavaScript, it is a plain download link); a failure is notified.
 *
 * @example
 * <DownloadPanel locale="en" href="/en/settings/export" />
 */
export function DownloadPanel({ locale, href }: DownloadPanelProperties) {
  const [pending, setPending] = useState(false);
  const { notify } = useToast();
  const words = ACCOUNT_WORDS.privacy;

  const download = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(href);
      if (!response.ok) throw new Error(String(response.status));
      const url = URL.createObjectURL(await response.blob());
      const save = document.createElement("a");
      save.href = url;
      save.download = fileName(response) ?? "";
      save.click();
      URL.revokeObjectURL(url);
    } catch {
      notify(say(ACCOUNT_WORDS.error.generic, locale), "error");
    }
    setPending(false);
  };

  return (
    <Card
      description={say(words.downloadText, locale)}
      action={
        <a
          href={href}
          download
          className={styles.link}
          aria-busy={pending || undefined}
          onClick={(event) => void download(event)}
        >
          {pending ? <span className={styles.spinner} aria-hidden="true" /> : <Icon name="download" />}
          {say(pending ? words.preparing : words.download, locale)}
        </a>
      }
    />
  );
}
