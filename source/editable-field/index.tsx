"use client";
import { useState, type FormEvent } from "react";
import { AccountButton } from "@sharadox/account-web-library/account-button";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { useToast } from "@sharadox/account-web-library/toast";
import styles from "./index.module.scss";
import type { EditablePanelProperties } from "@sharadox/account-web-library/editable-field/type";

/**
 * Data shown read-only with an Edit button; editing shows its fields with Save and Discard. Save shows a loader, then
 * a notification and the read-only view again; a refusal stays on the form with its reason. Discard (or Escape)
 * leaves the value as it was.
 *
 * @example
 * <EditablePanel locale="en" label="Name" view={name} fields={<TextField name="name" … />} onSave={save} />
 */
export function EditablePanel({ locale, label, view, fields, onSave, editLabel, extra }: EditablePanelProperties) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();
  const common = ACCOUNT_WORDS.common;

  const discard = () => {
    setEditing(false);
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const refusal = await onSave(new FormData(event.currentTarget));
    setPending(false);
    if (refusal) return setError(refusal);
    setEditing(false);
    notify(say(common.saved, locale));
  };

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <h3 className={styles.label}>{label}</h3>
        {!editing && (
          <div className={styles.actions}>
            {extra}
            <AccountButton look="quiet" icon="pencil" onClick={() => setEditing(true)}>
              {editLabel ?? say(common.edit, locale)}
            </AccountButton>
          </div>
        )}
      </div>
      {editing ? (
        <form
          className={styles.form}
          onSubmit={submit}
          onKeyDown={(event) => {
            if (event.key === "Escape") discard();
          }}
        >
          {fields}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.buttons}>
            <AccountButton type="submit" pending={pending} pendingLabel={say(common.saving, locale)}>
              {say(common.save, locale)}
            </AccountButton>
            <AccountButton look="quiet" onClick={discard} disabled={pending}>
              {say(common.discard, locale)}
            </AccountButton>
          </div>
        </form>
      ) : (
        <div className={styles.view}>{view}</div>
      )}
    </div>
  );
}
