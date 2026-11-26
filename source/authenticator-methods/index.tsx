"use client";
import Image from "next/image";
import { useState } from "react";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { Button } from "@sharadox/interface-web-library/button";
import { Card } from "@sharadox/interface-web-library/card";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { authenticatorDate } from "@sharadox/account-web-library/authenticator-label";
import { Checkbox } from "@sharadox/interface-web-library/checkbox";
import { Skeleton } from "@sharadox/interface-web-library/skeleton";
import { CodeDialog } from "@sharadox/account-web-library/code-dialog";
import { CopyButton } from "@sharadox/interface-web-library/copy-button";
import { Dialog } from "@sharadox/interface-web-library/dialog";
import { EditablePanel } from "@sharadox/account-web-library/editable-field";
import { TextField } from "@sharadox/interface-web-library/text-field";
import { RecoveryCodeList } from "@sharadox/account-web-library/recovery-codes";
import { Switch } from "@sharadox/interface-web-library/switch";
import styles from "./index.module.scss";
import type { AuthenticatorMethodsProperties } from "@sharadox/account-web-library/authenticator-methods/type";

/** A name as typed, trimmed: 1 to 50 characters. */
const typedName = (form: FormData | string) => String(typeof form === "string" ? form : form.get("name")).trim();

/**
 * The account's authenticator apps, any number, each shown by its name with the day it was added: required at every
 * sign-in or not (the switch flips at once), renamed, removed. Adding one shows its QR code straight away (the key to
 * type, with a copy button, only on request), its name (required), whether every sign-in asks for it, then the code it
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
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [required, setRequiredNow] = useState(false);
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
        setNameError(null);
        setRequiredNow(false);
      },
    });

  const closeOffer = () => {
    setOffer(false);
    setCodes(null);
  };

  return (
    <Card title={say(words.security.authenticators, locale)}>
      {authenticators === undefined && <Skeleton label={say(words.common.loading, locale)} shape="lines" lines={2} />}
      {authenticators !== undefined && authenticators.length > 0 && (
        <ul className={styles.list}>
          {authenticators.map((authenticator) => (
            <li key={authenticator.id} className={styles.item} aria-busy={removing === authenticator.id || undefined}>
              <EditablePanel
                locale={locale}
                label={`${say(words.security.addedOn, locale)} ${authenticatorDate(authenticator.createdAt, locale)}`}
                view={authenticator.name ?? say(words.security.noName, locale)}
                preview={(form) => typedName(form)}
                editLabel={say(words.security.rename, locale)}
                extra={
                  <>
                    <Switch
                      label={say(words.security.requiredToggle, locale)}
                      checked={authenticator.required}
                      onChange={async (on) =>
                        (await action.run(() => setRequired(authenticator.id, on), {
                          success: say(words.common.saved, locale),
                        })) !== null
                      }
                    />
                    <Button
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
                    </Button>
                  </>
                }
                fields={(saved) => (
                  <TextField
                    label={say(words.security.authenticatorName, locale)}
                    name="name"
                    defaultValue={saved ? typedName(saved) : (authenticator.name ?? "")}
                    placeholder={say(words.security.authenticatorNamePlaceholder, locale)}
                    maxLength={100}
                    autoFocus
                  />
                )}
                onSave={async (form) => {
                  const typed = typedName(form);
                  if (typed.length < 1 || typed.length > 50) return say(words.error.nameInvalid, locale);
                  return action.submit(() => rename(authenticator.id, typed));
                }}
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
            <Button look="plain" icon="key" onClick={() => setShowKey(true)}>
              {say(words.security.typeKey, locale)}
            </Button>
          )}
          <TextField
            label={say(words.security.authenticatorName, locale)}
            name="name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            placeholder={say(words.security.authenticatorNamePlaceholder, locale)}
            maxLength={100}
            required
            error={nameError}
            className={styles.name}
          />
          <Checkbox
            label={say(words.security.requiredToggle, locale)}
            checked={required}
            onChange={(event) => setRequiredNow(event.currentTarget.checked)}
          />
          <div className={styles.buttons}>
            <Button
              onClick={() => {
                const typed = typedName(name);
                if (typed.length < 1 || typed.length > 50)
                  return setNameError(say(typed ? words.error.nameInvalid : words.security.nameNeeded, locale));
                setNameError(null);
                setTyping(true);
              }}
            >
              {say(words.code.confirm, locale)}
            </Button>
            <Button look="quiet" onClick={() => setSetup(null)}>
              {say(words.common.cancel, locale)}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          look="quiet"
          icon="plus"
          onClick={begin}
          disabled={authenticators === undefined}
          pending={starting.pending}
          pendingLabel={say(words.security.preparing, locale)}
          className={styles.add}
        >
          {say(words.security.addAuthenticator, locale)}
        </Button>
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
          const refusal = await saving.submit(() => confirm(setup!.id, code, typedName(name), required), {
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
            <Button onClick={closeOffer}>{say(words.common.done, locale)}</Button>
          </>
        ) : (
          <>
            <p className={styles.offer}>{say(words.security.recoveryOffer, locale)}</p>
            <p className={styles.offer}>{say(words.security.recoveryText, locale)}</p>
            <div className={styles.buttons}>
              <Button
                pending={making.pending}
                onClick={() =>
                  void making.run(makeRecoveryCodes, { onDone: (answer) => setCodes(answer.recoveryCodes) })
                }
              >
                {say(words.security.makeCodes, locale)}
              </Button>
              <Button look="quiet" onClick={closeOffer}>
                {say(words.security.notNow, locale)}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </Card>
  );
}
