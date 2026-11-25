"use client";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { AccountCard } from "@sharadox/account-web-library/account-card";
import { checkAccountName, ACCOUNT_NAME_MAXIMUM_LENGTH } from "@sharadox/account-web-library/account-name";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { EditablePanel } from "@sharadox/account-web-library/editable-field";
import { checkIdentifier, IDENTIFIER_MAXIMUM_LENGTH } from "@sharadox/account-web-library/identifier";
import { TextField } from "@sharadox/account-web-library/input-group";
import type { IdentityPanelProperties } from "@sharadox/account-web-library/identity-panel/type";

/**
 * The account's name and identifier, each read-only until Edit, then saved or discarded on its own; values are checked
 * here first, then by the server. The identifier's "@" is its own part of the field, never part of the value.
 *
 * @example
 * <IdentityPanel locale="en" name="Ana" identifier="ana" changeName={changeName} changeIdentifier={changeIdentifier} />
 */
export function IdentityPanel({ locale, name, identifier, changeName, changeIdentifier }: IdentityPanelProperties) {
  const { submit } = useAccountAction();
  const words = ACCOUNT_WORDS;
  const tip = say(words.common.tip, locale);
  return (
    <AccountCard>
      <EditablePanel
        locale={locale}
        label={say(words.profile.name, locale)}
        view={name}
        fields={
          <TextField
            label={say(words.profile.name, locale)}
            name="name"
            defaultValue={name}
            autoComplete="name"
            maxLength={ACCOUNT_NAME_MAXIMUM_LENGTH * 2}
            tip={{ label: tip, text: say(words.signUp.nameTip, locale) }}
            required
            autoFocus
          />
        }
        onSave={async (form) => {
          const check = checkAccountName(String(form.get("name")));
          if (!check.valid) return say(words.error.nameInvalid, locale);
          return submit(() => changeName(check.name));
        }}
      />
      <EditablePanel
        locale={locale}
        label={say(words.profile.identifier, locale)}
        view={`@${identifier}`}
        fields={
          <TextField
            label={say(words.profile.identifier, locale)}
            name="identifier"
            prefix="@"
            defaultValue={identifier}
            autoComplete="username"
            spellCheck={false}
            autoCapitalize="none"
            maxLength={IDENTIFIER_MAXIMUM_LENGTH}
            tip={{ label: tip, text: say(words.signUp.identifierTip, locale) }}
            required
            autoFocus
          />
        }
        onSave={async (form) => {
          const value = String(form.get("identifier")).trim().replace(/^@+/, "");
          if (!checkIdentifier(value).valid) return say(words.error.identifierInvalid, locale);
          return submit(() => changeIdentifier(value));
        }}
      />
    </AccountCard>
  );
}
