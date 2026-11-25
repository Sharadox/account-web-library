import Image from "next/image";
import type { CSSProperties } from "react";
import { classNames } from "@sharadox/web-library/class-name";
import styles from "./index.module.scss";
import type { AccountAvatarProperties } from "@sharadox/account-web-library/account-avatar/type";

/**
 * A name's initials: the first letter of its first and last words (`Luis Pires` → `LP`), whole characters, so an
 * emoji counts as one.
 *
 * @example
 * initials("Ana Maria Silva"); // "AS"
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = (word: string) => [...word][0]!.toUpperCase();
  return words.length === 1 ? first(words[0]!) : `${first(words[0]!)}${first(words.at(-1)!)}`;
}

/**
 * An account's picture in a circle, or its initials in a ring of the accent when it has none. Decorative: the name is
 * always written or said next to it.
 *
 * @example
 * <AccountAvatar name={account.name} pictureUrl={account.pictureUrl} />
 */
export function AccountAvatar({ name, pictureUrl, size = 36, className }: AccountAvatarProperties) {
  const style = { "--size": `${size}px` } as CSSProperties;
  if (pictureUrl)
    return (
      // Already sized and in WebP by the account site, so it isn't optimized again.
      <Image
        src={pictureUrl}
        alt=""
        width={size}
        height={size}
        className={classNames(styles.avatar, className)}
        style={style}
        unoptimized
      />
    );
  return (
    <span className={classNames(styles.avatar, styles.initials, className)} style={style} aria-hidden>
      {initials(name)}
    </span>
  );
}
