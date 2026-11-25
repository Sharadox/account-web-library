"use client";
import { useState } from "react";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { Button } from "@sharadox/interface-web-library/button";
import { Card } from "@sharadox/interface-web-library/card";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { CopyButton } from "@sharadox/interface-web-library/copy-button";
import styles from "./index.module.scss";
import type {
  RecoveryCodeListProperties,
  RecoveryCodesProperties,
} from "@sharadox/account-web-library/recovery-codes/type";

/**
 * Recovery codes just made, shown once, with a button that copies them all and a reminder to keep them safe.
 *
 * @example
 * <RecoveryCodeList locale="en" codes={codes} />
 */
export function RecoveryCodeList({ locale, codes }: RecoveryCodeListProperties) {
  const words = ACCOUNT_WORDS;
  return (
    <div className={styles.shown}>
      <p className={styles.note}>{say(words.security.codesShown, locale)}</p>
      <ol className={styles.codes}>
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ol>
      <CopyButton
        value={codes.join("\n")}
        label={say(words.security.copyAll, locale)}
        copiedLabel={say(words.common.copied, locale)}
      />
    </div>
  );
}

/**
 * The account's recovery codes: how many are left, and making a set (new ones void the old), recommended but never
 * made unasked. Only with an authenticator on, as they stand in for one.
 *
 * @example
 * <RecoveryCodes locale="en" authenticators left={10} make={make} />
 */
export function RecoveryCodes({ locale, authenticators, left, make }: RecoveryCodesProperties) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const { run, pending } = useAccountAction();
  const words = ACCOUNT_WORDS.security;
  if (!authenticators) return null;
  return (
    <Card title={say(words.recoveryCodes, locale)} description={say(words.recoveryText, locale)}>
      <p className={styles.left}>
        <strong>{left}</strong> {say(words.codesLeft, locale)}
      </p>
      {codes && <RecoveryCodeList locale={locale} codes={codes} />}
      <Button
        look={left > 0 ? "quiet" : "primary"}
        pending={pending}
        onClick={() => void run(make, { onDone: (answer) => setCodes(answer.recoveryCodes) })}
        className={styles.make}
      >
        {say(left > 0 ? words.remakeCodes : words.makeCodes, locale)}
      </Button>
    </Card>
  );
}
