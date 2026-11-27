"use client";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { Button } from "@sharadox/interface-web-library/button";
import { Card } from "@sharadox/interface-web-library/card";
import { checkBirthday } from "@sharadox/account-web-library/account-birthday";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { EditablePanel } from "@sharadox/account-web-library/editable-field";
import { Select } from "@sharadox/interface-web-library/select";
import { SkeletonValue } from "@sharadox/interface-web-library/skeleton-value";
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
 * until Edit (day and month chosen from the interface's own selects), checked here first (a day that exists; 16 or
 * older with a year), and removable. While on its way, a skeleton.
 *
 * @example
 * <BirthdayPanel locale="en" birthday={{ day: 3, month: 7, year: null }} save={save} />
 */
export function BirthdayPanel({ locale, birthday, save }: BirthdayPanelProperties) {
  const { submit, run, pending } = useAccountAction();
  const words = ACCOUNT_WORDS.profile;
  const written = (day: number, month: number, year: number | null) =>
    `${day} ${monthName(month, locale)}${year ? ` ${year}` : ""}`;
  const shown =
    birthday === undefined ? (
      <SkeletonValue width="9ch" label={say(ACCOUNT_WORDS.common.loading, locale)} />
    ) : birthday ? (
      written(birthday.day, birthday.month, birthday.year)
    ) : (
      say(words.noBirthday, locale)
    );
  return (
    <Card>
      <EditablePanel
        locale={locale}
        label={say(ACCOUNT_WORDS.section.birthday, locale)}
        view={shown}
        ready={birthday !== undefined}
        note={<p>{say(words.birthdayText, locale)}</p>}
        preview={(form) =>
          written(Number(form.get("day")), Number(form.get("month")), Number(String(form.get("year")).trim()) || null)
        }
        editLabel={birthday ? undefined : say(ACCOUNT_WORDS.common.add, locale)}
        extra={
          birthday && (
            <Button
              look="secondary"
              icon="trash"
              pending={pending}
              onClick={() => void run(() => save(null), { success: say(ACCOUNT_WORDS.common.done, locale) })}
            >
              {say(words.clearBirthday, locale)}
            </Button>
          )
        }
        fields={(saved) => (
          <div className={styles.fields}>
            <Select
              label={say(words.day, locale)}
              name="day"
              placeholder={say(words.day, locale)}
              defaultValue={String(saved?.get("day") ?? birthday?.day ?? "")}
              options={Array.from({ length: 31 }, (_, index) => ({
                value: String(index + 1),
                label: String(index + 1),
              }))}
            />
            <Select
              label={say(words.month, locale)}
              name="month"
              placeholder={say(words.month, locale)}
              defaultValue={String(saved?.get("month") ?? birthday?.month ?? "")}
              options={Array.from({ length: 12 }, (_, index) => ({
                value: String(index + 1),
                label: monthName(index + 1, locale),
              }))}
            />
            <TextField
              label={say(words.year, locale)}
              name="year"
              type="number"
              inputMode="numeric"
              min={1900}
              defaultValue={String(saved?.get("year") ?? birthday?.year ?? "")}
            />
          </div>
        )}
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
