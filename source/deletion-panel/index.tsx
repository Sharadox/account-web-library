"use client";
import { useState, type FormEvent } from "react";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { Button } from "@sharadox/interface-web-library/button";
import { Card } from "@sharadox/interface-web-library/card";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { Dialog } from "@sharadox/interface-web-library/dialog";
import { TextField } from "@sharadox/interface-web-library/text-field";
import styles from "./index.module.scss";
import type { DeletionPanelProperties } from "@sharadox/account-web-library/deletion-panel/type";

/**
 * Deleting the account for good: a pop-up asks for the identifier to be typed (so it can't happen by accident), then a
 * fresh code (the server asks), then the account, its picture and everything else go.
 *
 * @example
 * <DeletionPanel locale="en" identifier="ana" remove={deleteAccount} />
 */
export function DeletionPanel({ locale, identifier = "", remove }: DeletionPanelProperties) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { submit, pending } = useAccountAction();
  const words = ACCOUNT_WORDS.privacy;

  const confirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const typed = String(new FormData(event.currentTarget).get("identifier")).trim().replace(/^@/, "");
    if (typed.toLowerCase() !== identifier.toLowerCase())
      return setError(say(ACCOUNT_WORDS.error.confirmation, locale));
    setError(await submit(remove, { refresh: false }));
  };

  return (
    <Card tone="danger" description={say(words.deletionText, locale)}>
      <Button
        look="danger"
        icon="trash"
        onClick={() => setAsking(true)}
        className={styles.button}
        disabled={!identifier}
      >
        {say(words.deleteAccount, locale)}
      </Button>
      <Dialog
        open={asking}
        onClose={() => {
          setAsking(false);
          setError(null);
        }}
        title={say(words.deleteAccountTitle, locale)}
        closeLabel={say(ACCOUNT_WORDS.common.close, locale)}
      >
        <form className={styles.form} onSubmit={confirm} noValidate>
          <p className={styles.text}>{say(words.deletionText, locale)}</p>
          <TextField
            label={say(words.confirmDeletion, locale)}
            name="identifier"
            prefix="@"
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            error={error}
            autoFocus
          />
          <Button
            type="submit"
            look="danger"
            pending={pending}
            pendingLabel={say(ACCOUNT_WORDS.common.working, locale)}
          >
            {say(words.deleteAccount, locale)}
          </Button>
        </form>
      </Dialog>
    </Card>
  );
}
