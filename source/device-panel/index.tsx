"use client";
import { useState } from "react";
import { Icon } from "@sharadox/icon-web-library/icon";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { AccountButton } from "@sharadox/account-web-library/account-button";
import { AccountCard } from "@sharadox/account-web-library/account-card";
import { formatAccountTime } from "@sharadox/account-web-library/account-time";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { describeBrowser } from "@sharadox/account-web-library/browser-description";
import styles from "./index.module.scss";
import type { DevicePanelProperties } from "@sharadox/account-web-library/device-panel/type";

/**
 * Where the account is signed in: each browser by name (`Safari on iPhone`), when it signed in and was last seen,
 * whether it passed more than one method, and signing out there for every browser but this one (signed out from the
 * menu).
 *
 * @example
 * <DevicePanel locale="en" devices={devices} end={endSession} />
 */
export function DevicePanel({ locale, devices, end }: DevicePanelProperties) {
  const { run } = useAccountAction();
  const [ending, setEnding] = useState<string | null>(null);
  const words = ACCOUNT_WORDS;
  return (
    <AccountCard>
      <ul className={styles.list}>
        {devices.map((device) => (
          <li
            key={device.accountSessionId}
            className={styles.device}
            aria-busy={ending === device.accountSessionId || undefined}
          >
            <Icon name="device" />
            <span className={styles.about}>
              <strong>
                {describeBrowser(device.userAgent, say(words.device.on, locale)) ?? say(words.device.unknown, locale)}
                {device.current && <em> · {say(words.security.thisDevice, locale)}</em>}
              </strong>
              <span>
                {say(words.security.signedInAt, locale)} {formatAccountTime(device.signedInAt, locale)} ·{" "}
                {say(words.security.lastSeen, locale)} {formatAccountTime(device.lastSeenAt, locale)}
                {device.secondFactor && ` · ${say(words.device.twoStep, locale)}`}
              </span>
            </span>
            {!device.current && (
              <AccountButton
                look="quiet"
                icon="sign-out"
                pending={ending === device.accountSessionId}
                pendingLabel={say(words.security.signingOut, locale)}
                onClick={async () => {
                  setEnding(device.accountSessionId);
                  await run(() => end(device.accountSessionId), { success: say(words.common.done, locale) });
                  setEnding(null);
                }}
              >
                {say(words.security.endSession, locale)}
              </AccountButton>
            )}
          </li>
        ))}
      </ul>
    </AccountCard>
  );
}
