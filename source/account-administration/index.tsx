"use client";
import { useState, type FormEvent } from "react";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { AccountAvatar } from "@sharadox/account-web-library/account-avatar";
import { Button } from "@sharadox/interface-web-library/button";
import { Card } from "@sharadox/interface-web-library/card";
import { Checkbox } from "@sharadox/interface-web-library/checkbox";
import { Select } from "@sharadox/interface-web-library/select";
import { formatAccountTime } from "@sharadox/account-web-library/account-time";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { EditablePanel } from "@sharadox/account-web-library/editable-field";
import { TextField } from "@sharadox/interface-web-library/text-field";
import styles from "./index.module.scss";
import type {
  AccountAdministrationProperties,
  AdministeredAccount,
} from "@sharadox/account-web-library/account-administration/type";

/** A form's text, trimmed; left out when empty. */
const optional = (form: FormData, name: string, key = name) => {
  const value = String(form.get(name)).trim();
  return value ? { [key]: value } : {};
};

/**
 * Finding an account (by identifier or email) and managing it: its roles (Give role: a form with Save and Cancel;
 * Take away), its bans, and banning it, citing the rules it broke. The server checks every permission again; nobody
 * can give a role with permissions they don't hold.
 *
 * @example
 * <AccountAdministration locale="en" roles={roles} rules={rules} banApplications={["platform"]} {...actions} />
 */
export function AccountAdministration({
  locale,
  roles = [],
  rules = [],
  banApplications,
  find,
  grant,
  revoke,
  ban,
}: AccountAdministrationProperties) {
  const [found, setFound] = useState<AdministeredAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searching = useAccountAction();
  const action = useAccountAction();
  const words = ACCOUNT_WORDS.administration;
  const done = say(ACCOUNT_WORDS.common.done, locale);

  const look = async (query: string) => {
    let account: AdministeredAccount | null = null;
    const refusal = await searching.submit(() => find(query), {
      refresh: false,
      onDone: (answer) => (account = answer),
    });
    setFound(account);
    return refusal;
  };
  const again = () => void look(found!.account.identifier);

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(await look(String(new FormData(event.currentTarget).get("query")).trim().replace(/^@+/, "")));
  };

  const when = (iso: string) => formatAccountTime(iso, locale);
  return (
    <>
      <Card>
        <form className={styles.search} onSubmit={search} role="search">
          <TextField
            label={say(words.find, locale)}
            name="query"
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="none"
            tip={{ label: say(ACCOUNT_WORDS.common.tip, locale), text: say(words.findTip, locale) }}
            error={error}
            required
          />
          <Button type="submit" pending={searching.pending} disabled={!banApplications}>
            {say(words.search, locale)}
          </Button>
        </form>
      </Card>
      {found && (
        <Card>
          <div className={styles.who}>
            <AccountAvatar name={found.account.name} pictureUrl={found.account.pictureUrl} size={48} />
            <span>
              <strong>{found.account.name}</strong>
              <span>@{found.account.identifier}</span>
            </span>
          </div>
          <h3 className={styles.subtitle}>{say(words.grants, locale)}</h3>
          {found.grants.length === 0 ? (
            <p className={styles.muted}>{say(words.noGrants, locale)}</p>
          ) : (
            <ul className={styles.list}>
              {found.grants.map((granted) => (
                <li key={granted.grantId} className={styles.row}>
                  <span>
                    <strong>{granted.roleName}</strong>{" "}
                    <span className={styles.muted}>{granted.application ?? "*"}</span>
                    {granted.resource && ` · ${say(words.resource, locale)} ${granted.resource}`}
                    {granted.endsAt &&
                      ` · ${say(granted.active ? words.until : words.ended, locale)} ${when(granted.endsAt)}`}
                  </span>
                  {granted.active && (
                    <Button
                      look="plain"
                      onClick={() => void action.run(() => revoke(granted.grantId), { success: done, onDone: again })}
                    >
                      {say(words.revoke, locale)}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <EditablePanel
            locale={locale}
            label={say(words.grant, locale)}
            view={null}
            editLabel={say(words.grant, locale)}
            fields={
              <div className={styles.fields}>
                <Select
                  label={say(words.role, locale)}
                  name="role"
                  defaultValue={roles[0] && `${roles[0].application}/${roles[0].key}`}
                  options={roles.map((role) => ({
                    value: `${role.application}/${role.key}`,
                    label: `${role.name} (${role.application})`,
                  }))}
                />
                <TextField label={say(words.resourceLabel, locale)} name="resource" maxLength={200} />
                <label className={styles.field}>
                  <span>{say(words.endsLabel, locale)}</span>
                  <input name="endsAt" type="date" />
                </label>
                <TextField label={say(words.reason, locale)} name="reason" maxLength={1000} />
              </div>
            }
            onSave={(form) => {
              const [application, role] = String(form.get("role")).split("/") as [string, string];
              return action.submit(
                () =>
                  grant({
                    accountId: found.account.accountId,
                    application,
                    role,
                    ...optional(form, "resource"),
                    ...optional(form, "endsAt"),
                    ...optional(form, "reason"),
                  }),
                { onDone: again },
              );
            }}
          />
          <h3 className={styles.subtitle}>{say(ACCOUNT_WORDS.section.banList, locale)}</h3>
          {found.bans.length === 0 ? (
            <p className={styles.muted}>{say(words.noBans, locale)}</p>
          ) : (
            <ul className={styles.list}>
              {found.bans.map((banned) => (
                <li key={banned.banId} className={styles.row}>
                  <span>
                    <strong>{banned.rules.join(", ")}</strong>{" "}
                    <span className={styles.muted}>{banned.application ?? "*"}</span> · {banned.statement}
                    {banned.endsAt &&
                      ` · ${say(banned.active ? words.until : words.ended, locale)} ${when(banned.endsAt)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {/* An account is found only once the search could run, so the lists are here by now. */}
          {banApplications!.length > 0 && rules.length > 0 ? (
            <EditablePanel
              locale={locale}
              label={say(words.ban, locale)}
              view={null}
              editLabel={say(words.ban, locale)}
              fields={
                <div className={styles.fields}>
                  <Select
                    label={say(words.where, locale)}
                    name="application"
                    defaultValue={banApplications![0]}
                    options={banApplications!.map((application) => ({ value: application, label: application }))}
                  />
                  <fieldset className={styles.rules}>
                    <legend>{say(words.rulesBroken, locale)}</legend>
                    {rules.map((rule) => (
                      <Checkbox
                        key={`${rule.application}-${rule.code}`}
                        name="rule"
                        value={rule.code}
                        label={
                          <>
                            {rule.title} <span className={styles.muted}>{rule.application ?? "*"}</span>
                          </>
                        }
                      />
                    ))}
                  </fieldset>
                  <label className={styles.field}>
                    <span>{say(words.statement, locale)}</span>
                    <textarea name="statement" rows={3} maxLength={2000} />
                  </label>
                </div>
              }
              onSave={async (form) => {
                const cited = form.getAll("rule").map(String);
                if (cited.length === 0) return say(words.pickRule, locale);
                return action.submit(
                  () =>
                    ban({
                      accountId: found.account.accountId,
                      application: String(form.get("application")),
                      rules: cited,
                      statement: String(form.get("statement")).trim(),
                    }),
                  { onDone: again },
                );
              }}
            />
          ) : (
            <p className={styles.muted}>{say(words.noRules, locale)}</p>
          )}
        </Card>
      )}
    </>
  );
}
