export interface RequiredSwitchProperties {
  /** What it switches ("Required at every sign-in"). */
  label: string;
  checked: boolean;
  /** Runs the change; the switch shows a loader meanwhile. */
  onChange: (checked: boolean) => Promise<unknown>;
  disabled?: boolean;
}
