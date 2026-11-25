"use client";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { AccountCard } from "@sharadox/account-web-library/account-card";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import type { Words } from "@sharadox/account-web-library/account-words/type";
import { EditablePanel } from "@sharadox/account-web-library/editable-field";
import styles from "./index.module.scss";
import type { PreferencePanelProperties } from "@sharadox/account-web-library/preference-panel/type";

const CHANNELS = ["in-app", "email"] as const;

/**
 * Where each kind of notice reaches the account: in the app (the bell) and by email. Read-only until Edit, then a
 * checkbox per kind and channel with Save and Discard. A locked channel can't be unticked, and a security notice keeps
 * at least one (the server says so if both are unticked).
 *
 * @example
 * <PreferencePanel locale="en" preferences={preferences} save={save} />
 */
export function PreferencePanel({ locale, preferences, save }: PreferencePanelProperties) {
  const { submit } = useAccountAction();
  const words = ACCOUNT_WORDS.notice;
  const kindText = (kind: string) => say((words as unknown as Record<string, Words>)[kind]!, locale);
  const table = (editing: boolean) => (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">{say(ACCOUNT_WORDS.common.notifications, locale)}</th>
          {CHANNELS.map((channel) => (
            <th key={channel} scope="col">
              {say(words[channel], locale)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {preferences.map((preference) => (
          <tr key={preference.kind}>
            <th scope="row">{kindText(preference.kind)}</th>
            {CHANNELS.map((channel) => {
              const { enabled, locked } = preference.channels[channel];
              return (
                <td key={channel}>
                  {editing ? (
                    <input
                      type="checkbox"
                      name={`${preference.kind}:${channel}`}
                      defaultChecked={enabled}
                      disabled={locked}
                      aria-label={`${kindText(preference.kind)}: ${say(words[channel], locale)}`}
                    />
                  ) : locked ? (
                    say(words.locked, locale)
                  ) : (
                    say(enabled ? ACCOUNT_WORDS.common.yes : ACCOUNT_WORDS.common.no, locale)
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <AccountCard description={say(words.preferencesText, locale)}>
      <EditablePanel
        locale={locale}
        label={say(ACCOUNT_WORDS.section.preferences, locale)}
        view={table(false)}
        fields={table(true)}
        onSave={(form) =>
          submit(() =>
            save(
              preferences.flatMap((preference) =>
                CHANNELS.filter((channel) => !preference.channels[channel].locked).map((channel) => ({
                  kind: preference.kind,
                  channel,
                  enabled: form.get(`${preference.kind}:${channel}`) === "on",
                })),
              ),
            ),
          )
        }
      />
    </AccountCard>
  );
}
