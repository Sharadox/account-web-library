"use client";
import { useState } from "react";
import styles from "./index.module.scss";
import type { RequiredSwitchProperties } from "@sharadox/account-web-library/required-switch/type";

/**
 * An on/off switch (a button with the switch role, read as on or off), busy while its change runs.
 *
 * @example
 * <RequiredSwitch label="Required at every sign-in" checked={required} onChange={(on) => setRequired(on)} />
 */
export function RequiredSwitch({ label, checked, onChange, disabled }: RequiredSwitchProperties) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-busy={pending || undefined}
      className={styles.switch}
      disabled={disabled || pending}
      onClick={async () => {
        setPending(true);
        await onChange(!checked);
        setPending(false);
      }}
    >
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      <span>{label}</span>
    </button>
  );
}
