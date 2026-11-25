"use client";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { AccountButton } from "@sharadox/account-web-library/account-button";
import { AccountCard } from "@sharadox/account-web-library/account-card";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { CodeDialog } from "@sharadox/account-web-library/code-dialog";
import { CopyButton } from "@sharadox/account-web-library/copy-button";
import { Dialog } from "@sharadox/account-web-library/dialog";
import { EditablePanel } from "@sharadox/account-web-library/editable-field";
import { TextField } from "@sharadox/account-web-library/input-group";
import { RecoveryCodeList } from "@sharadox/account-web-library/recovery-codes";
import { RequiredSwitch } from "@sharadox/account-web-library/required-switch";
import styles from "./index.module.scss";
import type { AuthenticatorMethodsProperties } from "@sharadox/account-web-library/authenticator-methods/type";

/** When an authenticator was added, in the reader's language. */
const added = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale === "pt" ? "pt-PT" : "en-GB", {
    dateStyle: "medium",
    timeZone: "Europe/Lisbon",
  }).format(new Date(iso));

/**
 * The account's authenticator apps, any number, each named: required at every sign-in or not, renamed, removed.
 * Adding one: its name (Save, Discard), then a QR code to scan or a key to type (with a copy button), then the code it
 * shows, in a pop-up. Once it's on, recovery codes are offered (never made unasked) when the account has none.
 *
 * @example
 * <AuthenticatorMethods locale="en" company="Acme" authenticators={list} recoveryCodesLeft={0} {...actions} />
 */
export function AuthenticatorMethods({
  locale,
  company,
  authenticators,
  recoveryCodesLeft,
  start,
  confirm,
  rename,
  remove,
  setRequired,
  makeRecoveryCodes,
}: AuthenticatorMethodsProperties) {
  const [naming, setNaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [typing, setTyping] = useState(false);
  const [offer, setOffer] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const action = useAccountAction();
  const saving = useAccountAction();
  const making = useAccountAction();
  const words = ACCOUNT_WORDS;
  const tip = say(words.common.tip, locale);

  const begin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const name = String(new FormData(event.currentTarget).get("name")).trim();
    if (name.length < 1 || name.length > 50) return setError(say(words.error.nameInvalid, locale));
    const refusal = await saving.submit(() => start(name), { refresh: false, onDone: (answer) => setSetup(answer) });
    if (refusal) return setError(refusal);
    setNaming(false);
  };

  const closeOffer = () => {
    setOffer(false);
    setCodes(null);
  };

  return (
    <AccountCard title={say(words.security.authenticators, locale)}>
      {authenticators.length > 0 && (
        <ul className={styles.list}>
          {authenticators.map((authenticator) => (
            <li key={authenticator.id} className={styles.item}>
              <EditablePanel
                locale={locale}
                label={added(authenticator.createdAt, locale)}
                view={<strong>{authenticator.name}</strong>}
                editLabel={say(words.security.rename, locale)}
                extra={
                  <AccountButton
                    look="plain"
                    icon="trash"
                    onClick={() =>
                      void action.run(() => remove(authenticator.id), { success: say(words.common.done, locale) })
                    }
                  >
                    {say(words.common.remove, locale)}
                  </AccountButton>
                }
                fields={
                  <TextField
                    label={say(words.security.authenticatorName, locale)}
                    name="name"
                    defaultValue={authenticator.name}
                    maxLength={50}
                    required
                    autoFocus
                  />
                }
                onSave={async (form) => {
                  const name = String(form.get("name")).trim();
                  if (name.length < 1 || name.length > 50) return say(words.error.nameInvalid, locale);
                  return action.submit(() => rename(authenticator.id, name));
                }}
              />
              <RequiredSwitch
                label={say(words.security.requiredToggle, locale)}
                checked={authenticator.required}
                onChange={(required) =>
                  action.run(() => setRequired(authenticator.id, required), {
                    success: say(words.common.saved, locale),
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}
      {naming ? (
        <form className={styles.form} onSubmit={begin} noValidate>
          <TextField
            label={say(words.security.authenticatorName, locale)}
            name="name"
            maxLength={50}
            tip={{ label: tip, text: say(words.security.authenticatorNameTip, locale) }}
            error={error}
            required
            autoFocus
          />
          <div className={styles.buttons}>
            <AccountButton type="submit" pending={saving.pending} pendingLabel={say(words.common.working, locale)}>
              {say(words.common.save, locale)}
            </AccountButton>
            <AccountButton
              look="quiet"
              onClick={() => {
                setNaming(false);
                setError(null);
              }}
            >
              {say(words.common.discard, locale)}
            </AccountButton>
          </div>
        </form>
      ) : setup ? (
        <div className={styles.setup}>
          <p>{say(words.security.scan, locale)}</p>
          <Image src={setup.qr} alt="" width={180} height={180} className={styles.qr} unoptimized />
          <div className={styles.key}>
            <span>{say(words.security.key, locale)}</span>
            <code>{setup.secret.replace(/(.{4})(?=.)/g, "$1 ")}</code>
            <CopyButton
              value={setup.secret}
              label={say(words.common.copy, locale)}
              copiedLabel={say(words.common.copied, locale)}
            />
          </div>
          <div className={styles.buttons}>
            <AccountButton onClick={() => setTyping(true)}>{say(words.code.confirm, locale)}</AccountButton>
            <AccountButton look="quiet" onClick={() => setSetup(null)}>
              {say(words.common.cancel, locale)}
            </AccountButton>
          </div>
        </div>
      ) : (
        <AccountButton look="quiet" icon="plus" onClick={() => setNaming(true)} className={styles.add}>
          {say(words.security.addAuthenticator, locale)}
        </AccountButton>
      )}
      <CodeDialog
        locale={locale}
        open={typing}
        onClose={() => setTyping(false)}
        title={say(words.code.authenticatorTitle, locale)}
        text={
          <p>
            {say(words.code.authenticatorText, locale)} <strong>{company}</strong>.
          </p>
        }
        onSubmit={async (code) => {
          const refusal = await saving.submit(() => confirm(setup!.id, code), {
            success: say(words.common.saved, locale),
          });
          if (refusal) return refusal;
          setTyping(false);
          setSetup(null);
          if (recoveryCodesLeft === 0) setOffer(true);
          return null;
        }}
      />
      <Dialog
        open={offer}
        onClose={closeOffer}
        title={say(words.security.recoveryCodes, locale)}
        closeLabel={say(words.common.close, locale)}
      >
        {codes ? (
          <>
            <RecoveryCodeList locale={locale} codes={codes} />
            <AccountButton onClick={closeOffer}>{say(words.common.done, locale)}</AccountButton>
          </>
        ) : (
          <>
            <p className={styles.offer}>{say(words.security.recoveryOffer, locale)}</p>
            <p className={styles.offer}>{say(words.security.recoveryText, locale)}</p>
            <div className={styles.buttons}>
              <AccountButton
                pending={making.pending}
                onClick={() =>
                  void making.run(makeRecoveryCodes, { onDone: (answer) => setCodes(answer.recoveryCodes) })
                }
              >
                {say(words.security.makeCodes, locale)}
              </AccountButton>
              <AccountButton look="quiet" onClick={closeOffer}>
                {say(words.security.notNow, locale)}
              </AccountButton>
            </div>
          </>
        )}
      </Dialog>
    </AccountCard>
  );
}
