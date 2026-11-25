"use client";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { Button } from "@sharadox/interface-web-library/button";
import { Card } from "@sharadox/interface-web-library/card";
import { checkBirthday } from "@sharadox/account-web-library/account-birthday";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { EditablePanel } from "@sharadox/account-web-library/editable-field";
import { TextField } from "@sharadox/interface-web-library/text-field";
import styles from "./index.module.scss";
import type { BirthdayPanelProperties } from "@sharadox/account-web-library/birthday-panel/type";

/** The month's name in the reader's language. */
const monthName = (month: number, locale: string) =>
  new Intl.DateTimeFormat(locale === "pt" ? "pt-PT" : "en-GB", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2000, month - 1, 1)),
  );

/**
 * The account's birthday, optional, for a birthday present: day and month (the year if the owner wants), read-only
 * until Edit, checked here first (a day that exists; 16 or older with a year), and removable.
 *
 * @example
 * <BirthdayPanel locale="en" birthday={{ day: 3, month: 7, year: null }} save={save} />
 */
export function BirthdayPanel({ locale, birthday, save }: BirthdayPanelProperties) {
  const { submit, run, pending } = useAccountAction();
  const words = ACCOUNT_WORDS.profile;
  const written = (day: number, month: number, year: number | null) =>
    `${day} ${monthName(month, locale)}${year ? ` ${year}` : ""}`;
  const shown = birthday ? written(birthday.day, birthday.month, birthday.year) : say(words.noBirthday, locale);
  return (
    <Card description={say(words.birthdayText, locale)}>
      <EditablePanel
        locale={locale}
        label={say(ACCOUNT_WORDS.section.birthday, locale)}
        view={shown}
        preview={(form) =>
          written(Number(form.get("day")), Number(form.get("month")), Number(String(form.get("year")).trim()) || null)
        }
        editLabel={birthday ? undefined : say(ACCOUNT_WORDS.common.add, locale)}
        extra={
          birthday && (
            <Button
              look="quiet"
              icon="trash"
              pending={pending}
              onClick={() => void run(() => save(null), { success: say(ACCOUNT_WORDS.common.done, locale) })}
            >
              {say(words.clearBirthday, locale)}
            </Button>
          )
        }
        fields={
          <div className={styles.fields}>
            <TextField
              label={say(words.day, locale)}
              name="day"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              defaultValue={birthday?.day}
              required
              autoFocus
            />
            <span className={styles.month}>
              <label htmlFor="birthday-month">{say(words.month, locale)}</label>
              <select id="birthday-month" name="month" defaultValue={birthday?.month ?? 1}>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index} value={index + 1}>
                    {monthName(index + 1, locale)}
                  </option>
                ))}
              </select>
            </span>
            <TextField
              label={say(words.year, locale)}
              name="year"
              type="number"
              inputMode="numeric"
              min={1900}
              defaultValue={birthday?.year ?? undefined}
            />
          </div>
        }
        onSave={async (form) => {
          const year = String(form.get("year")).trim();
          const chosen = {
            day: Number(form.get("day")),
            month: Number(form.get("month")),
            year: year ? Number(year) : null,
          };
          const check = checkBirthday(chosen);
          if (!check.valid) return say(ACCOUNT_WORDS.error[check.reason], locale);
          return submit(() => save(chosen));
        }}
      />
    </Card>
  );
}
