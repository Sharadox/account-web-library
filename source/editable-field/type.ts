import type { ReactNode } from "react";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface EditablePanelProperties {
  locale: AccountLocale;
  /** What the panel shows, its heading ("Name"). */
  label: string;
  /** The value as it is, read-only (a string, or an element that keeps its identity until the value changes). */
  view: ReactNode;
  /**
   * The value as it will be, from the form: shown at once on Save, marked as saving, until the page's new value
   * arrives. Without it, the form waits with a loader.
   */
  preview?: (form: FormData) => ReactNode;
  /**
   * The form's fields while editing (named inputs). As a function, it gets what was last saved (until the page has
   * the new value), so editing again starts from it: `defaultValue={saved?.get("name") ?? name}`.
   */
  fields: ReactNode | ((saved: FormData | null) => ReactNode);
  /** False while the value is still on its way: Edit waits (true by default). */
  ready?: boolean;
  /** A line under the value in read mode (what it's for). */
  note?: ReactNode;
  /**
   * Saves the form: an error to show, or null when saved (then a notification says so and the panel shows the new
   * value).
   */
  onSave: (form: FormData) => Promise<string | null>;
  /** The Edit button's words, when not "Edit" ("Add", "Change"). */
  editLabel?: string;
  /** Something beside Edit in read mode (a Remove button). */
  extra?: ReactNode;
}
