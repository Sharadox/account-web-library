"use client";
import { useRef, useState } from "react";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { AccountAvatar } from "@sharadox/account-web-library/account-avatar";
import { Button } from "@sharadox/interface-web-library/button";
import { Card } from "@sharadox/interface-web-library/card";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { PendingMark } from "@sharadox/interface-web-library/pending-mark";
import { SkeletonValue } from "@sharadox/interface-web-library/skeleton-value";
import { useToast } from "@sharadox/interface-web-library/toast";
import styles from "./index.module.scss";
import type { PicturePanelProperties } from "@sharadox/account-web-library/picture-panel/type";

/** The largest picture file sent (the server checks it again). */
const PICTURE_BYTES = 5 * 1024 * 1024;

/**
 * The account's picture in its own card: a chosen file shows at once and uploads (a loader on the picture; files over 5 MB are refused here
 * first), and removing it hides it at once; either goes back if the server refuses. The old picture is deleted from
 * storage by the server.
 *
 * @example
 * <PicturePanel locale="en" name="Ana" pictureUrl={url} upload={upload} remove={remove} />
 */
export function PicturePanel({ locale, name, pictureUrl: given, upload, remove }: PicturePanelProperties) {
  const pictureUrl = given ?? null;
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
    <Card>
      <div className={styles.picture}>
        <span className={styles.preview}>
          {name === undefined ? (
            <SkeletonValue circle={96} label={say(ACCOUNT_WORDS.common.loading, locale)} />
          ) : (
            <AccountAvatar name={name} pictureUrl={picture ?? null} size={96} />
          )}
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
          {/* The picture itself shows the upload's loader: one loader for one thing. */}
          <Button icon="plus" disabled={uploading.pending || name === undefined} onClick={() => file.current!.click()}>
            {say(words.choosePicture, locale)}
          </Button>
          {picture && (
            <Button look="secondary" icon="trash" pending={removing.pending} onClick={() => void drop()}>
              {say(words.removePicture, locale)}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
