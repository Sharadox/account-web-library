"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@sharadox/interface-web-library/button";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { PendingMark } from "@sharadox/interface-web-library/pending-mark";
import { useToast } from "@sharadox/interface-web-library/toast";
import styles from "./index.module.scss";
import type { EditablePanelProperties } from "@sharadox/account-web-library/editable-field/type";

/**
 * Data shown read-only with an Edit button; editing shows its fields with Save and Cancel. With `preview`, Save shows
 * the new value at once, marked as saving, and keeps it until the page's own value arrives; a refusal brings the form
 * back as it was typed, with its reason. Without one, the form stays with a loader on Save. Cancel (or Escape) leaves
 * the value as it was.
 *
 * @example
 * <EditablePanel locale="en" label="Name" view={name} preview={(form) => form.get("name")} fields={…} onSave={save} />
 */
export function EditablePanel({
  locale,
  label,
  view,
  preview,
  fields,
  onSave,
  editLabel,
  extra,
  note,
  ready = true,
}: EditablePanelProperties) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The new value shown before the page has it: kept while the view it replaced is still the one given.
  const [shown, setShown] = useState<{ value: ReactNode; over: ReactNode } | null>(null);
  // What was last saved, for editing again before the page has it.
  const [saved, setSaved] = useState<{ form: FormData; over: ReactNode } | null>(null);
  const latest = saved && Object.is(saved.over, view) ? saved.form : null;
  const { notify } = useToast();
  const common = ACCOUNT_WORDS.common;
  const previewing = shown !== null && (pending || Object.is(shown.over, view));

  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    if (preview) {
      setShown({ value: preview(form), over: view });
      setEditing(false);
    }
    const refusal = await onSave(form);
    setPending(false);
    if (refusal) {
      setShown(null);
      setEditing(true);
      return setError(refusal);
    }
    setEditing(false);
    setSaved({ form, over: view });
    notify(say(common.saved, locale));
  };

  return (
    <div className={styles.panel}>
      {!editing && (
        <div className={styles.summary} data-part="summary">
          <div className={styles.text}>
            <h3 className={styles.label}>{label}</h3>
            <div className={styles.view}>
              {previewing ? shown.value : view}
              {pending && <PendingMark label={say(common.saving, locale)} />}
            </div>
            {note && <div className={styles.note}>{note}</div>}
          </div>
          {!pending && (
            <div className={styles.actions}>
              {extra}
              <Button look="secondary" icon="pencil" disabled={!ready} onClick={() => setEditing(true)}>
                {editLabel ?? say(common.edit, locale)}
              </Button>
            </div>
          )}
        </div>
      )}
      {/* The form stays mounted while a preview shows, so a refusal brings back what was typed. */}
      {(editing || (pending && previewing)) && (
        <form
          className={styles.form}
          hidden={!editing}
          onSubmit={submit}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancel();
          }}
        >
          {editing && <h3 className={styles.label}>{label}</h3>}
          {typeof fields === "function" ? fields(latest) : fields}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.buttons}>
            <Button type="submit" pending={pending} pendingLabel={say(common.saving, locale)}>
              {say(common.save, locale)}
            </Button>
            <Button look="secondary" onClick={cancel} disabled={pending}>
              {say(common.cancel, locale)}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
