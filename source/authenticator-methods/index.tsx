"use client";
import Image from "next/image";
import { useState } from "react";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { AccountButton } from "@sharadox/account-web-library/account-button";
import { AccountCard } from "@sharadox/account-web-library/account-card";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { authenticatorDate, authenticatorLabel } from "@sharadox/account-web-library/authenticator-label";
import { CodeDialog } from "@sharadox/account-web-library/code-dialog";
import { CopyButton } from "@sharadox/account-web-library/copy-button";
import { Dialog } from "@sharadox/account-web-library/dialog";
import { EditablePanel } from "@sharadox/account-web-library/editable-field";
import { TextField } from "@sharadox/account-web-library/input-group";
import { RecoveryCodeList } from "@sharadox/account-web-library/recovery-codes";
import { RequiredSwitch } from "@sharadox/account-web-library/required-switch";
import styles from "./index.module.scss";
import type { AuthenticatorMethodsProperties } from "@sharadox/account-web-library/authenticator-methods/type";

/** A name as typed: trimmed, and too long when over 50 characters (an empty one means no name). */
const typedName = (form: FormData | string) => String(typeof form === "string" ? form : form.get("name")).trim();

/**
 * The account's authenticator apps, any number: each called by its name, or by the day it was added; required at
 * every sign-in or not (the switch flips at once), renamed, removed. Adding one shows its QR code straight away (the
 * key to type, with a copy button, only on request), then an optional name, then the code it shows, in a pop-up.
 * Once it's on, recovery codes are offered (never made unasked) when the account has none.
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
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [name, setName] = useState("");
  const [typing, setTyping] = useState(false);
  const [offer, setOffer] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const action = useAccountAction();
  const starting = useAccountAction();
  const saving = useAccountAction();
  const making = useAccountAction();
  const words = ACCOUNT_WORDS;

  const begin = () =>
    void starting.run(start, {
      refresh: false,
      onDone: (answer) => {
        setSetup(answer);
        setShowKey(false);
        setName("");
      },
    });

  const closeOffer = () => {
    setOffer(false);
    setCodes(null);
  };

  return (
    <AccountCard title={say(words.security.authenticators, locale)}>
      {authenticators.length > 0 && (
        <ul className={styles.list}>
          {authenticators.map((authenticator) => (
            <li key={authenticator.id} className={styles.item} aria-busy={removing === authenticator.id || undefined}>
              <EditablePanel
                locale={locale}
                label={
                  authenticator.name === null
                    ? say(words.security.noName, locale)
                    : `${say(words.security.addedOn, locale)} ${authenticatorDate(authenticator.createdAt, locale)}`
                }
                view={authenticatorLabel(authenticator, locale)}
                preview={(form) => authenticatorLabel({ ...authenticator, name: typedName(form) || null }, locale)}
                editLabel={say(words.security.rename, locale)}
                extra={
                  <AccountButton
                    look="plain"
                    icon="trash"
                    pending={removing === authenticator.id}
                    pendingLabel={say(words.common.removing, locale)}
                    onClick={async () => {
                      setRemoving(authenticator.id);
                      await action.run(() => remove(authenticator.id), { success: say(words.common.done, locale) });
                      setRemoving(null);
                    }}
                  >
                    {say(words.common.remove, locale)}
                  </AccountButton>
                }
                fields={
                  <TextField
                    label={say(words.security.authenticatorNameOptional, locale)}
                    name="name"
                    defaultValue={authenticator.name ?? ""}
                    maxLength={100}
                    autoFocus
                  />
                }
                onSave={async (form) => {
                  const typed = typedName(form);
                  if (typed.length > 50) return say(words.error.nameInvalid, locale);
                  return action.submit(() => rename(authenticator.id, typed));
                }}
              />
              <RequiredSwitch
                label={say(words.security.requiredToggle, locale)}
                checked={authenticator.required}
                onChange={async (required) =>
                  (await action.run(() => setRequired(authenticator.id, required), {
                    success: say(words.common.saved, locale),
                  })) !== null
                }
              />
            </li>
          ))}
        </ul>
      )}
      {setup ? (
        <div className={styles.setup}>
          <p>{say(words.security.scan, locale)}</p>
          <Image
            src={setup.qr}
            alt={say(words.security.qr, locale)}
            width={180}
            height={180}
            className={styles.qr}
            unoptimized
          />
          {showKey ? (
            <div className={styles.key}>
              <span>{say(words.security.key, locale)}</span>
              <code>{setup.secret.replace(/(.{4})(?=.)/g, "$1 ")}</code>
              <CopyButton
                value={setup.secret}
                label={say(words.common.copy, locale)}
                copiedLabel={say(words.common.copied, locale)}
              />
            </div>
          ) : (
            <AccountButton look="plain" icon="key" onClick={() => setShowKey(true)}>
              {say(words.security.typeKey, locale)}
            </AccountButton>
          )}
          <TextField
            label={say(words.security.authenticatorNameOptional, locale)}
            name="name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            maxLength={100}
            hint={say(words.security.nameLater, locale)}
            className={styles.name}
          />
          <div className={styles.buttons}>
            <AccountButton onClick={() => setTyping(true)}>{say(words.code.confirm, locale)}</AccountButton>
            <AccountButton look="quiet" onClick={() => setSetup(null)}>
              {say(words.common.cancel, locale)}
            </AccountButton>
          </div>
        </div>
      ) : (
        <AccountButton
          look="quiet"
          icon="plus"
          onClick={begin}
          pending={starting.pending}
          pendingLabel={say(words.security.preparing, locale)}
          className={styles.add}
        >
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
          const refusal = await saving.submit(() => confirm(setup!.id, code, typedName(name)), {
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
