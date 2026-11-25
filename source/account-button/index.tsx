import { Icon } from "@sharadox/icon-web-library/icon";
import { classNames } from "@sharadox/web-library/class-name";
import styles from "./index.module.scss";
import type { AccountButtonProperties } from "@sharadox/account-web-library/account-button/type";

/**
 * The account screens' button: the accent, outlined, danger or plain text, with an optional icon. While `pending` it
 * shows a spinner (and `pendingLabel`), is marked busy and ignores clicks, so an action never runs twice.
 *
 * @example
 * <AccountButton type="submit" pending={saving} pendingLabel="Saving…">Save</AccountButton>
 */
export function AccountButton({
  look = "primary",
  pending = false,
  pendingLabel,
  icon,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: AccountButtonProperties) {
  return (
    <button
      {...rest}
      type={type}
      className={classNames(styles.button, styles[look], className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending ? <span className={styles.spinner} aria-hidden="true" /> : icon && <Icon name={icon} />}
      <span>{pending && pendingLabel ? pendingLabel : children}</span>
    </button>
  );
}
