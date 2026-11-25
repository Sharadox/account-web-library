"use client";
import { useRef, useState } from "react";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { AccountAvatar } from "@sharadox/account-web-library/account-avatar";
import { AccountButton } from "@sharadox/account-web-library/account-button";
import { AccountCard } from "@sharadox/account-web-library/account-card";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { PendingMark } from "@sharadox/account-web-library/pending-mark";
import { useToast } from "@sharadox/account-web-library/toast";
import styles from "./index.module.scss";
import type { PicturePanelProperties } from "@sharadox/account-web-library/picture-panel/type";

/** The largest picture file sent (the server checks it again). */
const PICTURE_BYTES = 5 * 1024 * 1024;

/**
 * The account's picture: a chosen file shows at once and uploads (with a loader; files over 5 MB are refused here
 * first), and removing it hides it at once; either goes back if the server refuses. The old picture is deleted from
 * storage by the server.
 *
 * @example
 * <PicturePanel locale="en" name="Ana" pictureUrl={url} upload={upload} remove={remove} />
 */
export function PicturePanel({ locale, name, pictureUrl, upload, remove }: PicturePanelProperties) {
  const uploading = useAccountAction();
  const removing = useAccountAction();
  const { notify } = useToast();
  const file = useRef<HTMLInputElement>(null);
  const words = ACCOUNT_WORDS.profile;
  // The picture as it will be, shown before the page has it: a chosen file, or none once removed.
  const [shown, setShown] = useState<{ url: string | null; over: string | null } | null>(null);
  const picture = shown && shown.over === pictureUrl ? shown.url : pictureUrl;

  const send = () => {
    const chosen = file.current!.files?.[0];
    if (!chosen) return;
    file.current!.value = "";
    if (chosen.size > PICTURE_BYTES) return notify(say(ACCOUNT_WORDS.error.size, locale), "error");
    const form = new FormData();
    form.set("picture", chosen);
    const preview = URL.createObjectURL(chosen);
    setShown({ url: preview, over: pictureUrl });
    void uploading
      .run(() => upload(form), { success: say(ACCOUNT_WORDS.common.saved, locale) })
      .then((done) => {
        if (done) return;
        setShown(null);
        URL.revokeObjectURL(preview);
      });
  };

  const drop = async () => {
    setShown({ url: null, over: pictureUrl });
    if (!(await removing.run(remove, { success: say(ACCOUNT_WORDS.common.done, locale) }))) setShown(null);
  };

  return (
    <AccountCard description={say(words.pictureText, locale)}>
      <div className={styles.picture}>
        <span className={styles.preview}>
          <AccountAvatar name={name} pictureUrl={picture} size={96} />
          {uploading.pending && <PendingMark label={say(words.uploading, locale)} />}
        </span>
        <div className={styles.buttons}>
          <input
            ref={file}
            id="account-picture"
            type="file"
            name="picture"
            accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/svg+xml"
            onChange={send}
            className={styles.file}
            aria-label={say(words.choosePicture, locale)}
          />
          <AccountButton
            icon="plus"
            pending={uploading.pending}
            pendingLabel={say(words.uploading, locale)}
            onClick={() => file.current!.click()}
          >
            {say(words.choosePicture, locale)}
          </AccountButton>
          {picture && (
            <AccountButton look="quiet" icon="trash" pending={removing.pending} onClick={() => void drop()}>
              {say(words.removePicture, locale)}
            </AccountButton>
          )}
        </div>
      </div>
    </AccountCard>
  );
}
