import { Icon } from "@sharadox/icon-web-library/icon";
import { SkeletonValue } from "@sharadox/interface-web-library/skeleton-value";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import type { PendingRowsProperties } from "@sharadox/account-web-library/pending-rows/type";

/**
 * A list's rows while its data is on its way: the same list and rows (and their icon), with a skeleton where each
 * value will be, said once to be loading. Panels show it inside their card instead of their rows, so only the data
 * waits.
 *
 * @example
 * {devices ? <ul className={styles.list}>…</ul> : <PendingRows locale="en" rows={2} values={["18ch", "30ch"]} icon="device" className={styles.list} />}
 */
export function PendingRows({ locale, rows, values, icon, ordered, className, rowClassName }: PendingRowsProperties) {
  const List = ordered ? "ol" : "ul";
  const loading = say(ACCOUNT_WORDS.common.loading, locale);
  return (
    <List className={className} aria-busy="true">
      {Array.from({ length: rows }, (_, row) => (
        <li key={row} className={rowClassName}>
          {icon && <Icon name={icon} />}
          {values.map((width, value) => (
            <SkeletonValue key={value} width={width} {...(row === 0 && value === 0 ? { label: loading } : {})} />
          ))}
        </li>
      ))}
    </List>
  );
}
