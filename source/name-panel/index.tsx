"use client";
import { Card } from "@sharadox/interface-web-library/card";
import { SkeletonValue } from "@sharadox/interface-web-library/skeleton-value";
import { TextField } from "@sharadox/interface-web-library/text-field";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { ACCOUNT_NAME_MAXIMUM_LENGTH, checkAccountName } from "@sharadox/account-web-library/account-name";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { EditablePanel } from "@sharadox/account-web-library/editable-field";
import type { NamePanelProperties } from "@sharadox/account-web-library/name-panel/type";

/**
 * The account's name in its own card: read-only until Edit, checked here, then saved (shown at once, marked as
 * saving) or cancelled. Editing again right after starts from the saved name.
 *
 * @example
 * <NamePanel locale="en" name="Ana Silva" change={changeName} />
 */
export function NamePanel({ locale, name, change }: NamePanelProperties) {
  const { submit } = useAccountAction();
  const words = ACCOUNT_WORDS;
  return (
    <Card>
      <EditablePanel
        locale={locale}
        label={say(words.profile.name, locale)}
        view={name ?? <SkeletonValue width="12ch" label={say(words.common.loading, locale)} />}
        ready={name !== undefined}
        preview={(form) => String(form.get("name")).trim()}
        fields={(saved) => (
          <TextField
            label={say(words.profile.name, locale)}
            name="name"
            defaultValue={String(saved?.get("name") ?? name)}
            autoComplete="name"
            maxLength={ACCOUNT_NAME_MAXIMUM_LENGTH * 2}
            tip={{ label: say(words.common.tip, locale), text: say(words.signUp.nameTip, locale) }}
            required
            autoFocus
          />
        )}
        onSave={async (form) => {
          const check = checkAccountName(String(form.get("name")));
          if (!check.valid) return say(words.error.nameInvalid, locale);
          return submit(() => change(check.name));
        }}
      />
    </Card>
  );
}
