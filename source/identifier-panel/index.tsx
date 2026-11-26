"use client";
import { Card } from "@sharadox/interface-web-library/card";
import { SkeletonValue } from "@sharadox/interface-web-library/skeleton-value";
import { TextField } from "@sharadox/interface-web-library/text-field";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { EditablePanel } from "@sharadox/account-web-library/editable-field";
import { checkIdentifier, IDENTIFIER_MAXIMUM_LENGTH } from "@sharadox/account-web-library/identifier";
import type { IdentifierPanelProperties } from "@sharadox/account-web-library/identifier-panel/type";

/** What was typed, without any leading "@". */
const typed = (form: FormData) => String(form.get("identifier")).trim().replace(/^@+/, "");

/**
 * The account's identifier in its own card: read-only until Edit, checked here, then saved (shown at once, marked as
 * saving) or cancelled. The "@" is its own part of the field, never part of the value.
 *
 * @example
 * <IdentifierPanel locale="en" identifier="ana" change={changeIdentifier} />
 */
export function IdentifierPanel({ locale, identifier, change }: IdentifierPanelProperties) {
  const { submit } = useAccountAction();
  const words = ACCOUNT_WORDS;
  return (
    <Card>
      <EditablePanel
        locale={locale}
        label={say(words.profile.identifier, locale)}
        view={
          identifier === undefined ? (
            <SkeletonValue width="10ch" label={say(words.common.loading, locale)} />
          ) : (
            `@${identifier}`
          )
        }
        ready={identifier !== undefined}
        preview={(form) => `@${typed(form)}`}
        fields={(saved) => (
          <TextField
            label={say(words.profile.identifier, locale)}
            name="identifier"
            prefix="@"
            defaultValue={saved ? typed(saved) : identifier}
            autoComplete="username"
            spellCheck={false}
            autoCapitalize="none"
            maxLength={IDENTIFIER_MAXIMUM_LENGTH}
            tip={{ label: say(words.common.tip, locale), text: say(words.signUp.identifierTip, locale) }}
            required
            autoFocus
          />
        )}
        onSave={async (form) => {
          const value = typed(form);
          if (!checkIdentifier(value).valid) return say(words.error.identifierInvalid, locale);
          return submit(() => change(value));
        }}
      />
    </Card>
  );
}
