import type { CSSProperties } from "react";
import { interfaceThemeStyle } from "@sharadox/interface-web-library/interface-theme";
import type { AccountThemeProperties, AccountThemeValues } from "@sharadox/account-web-library/account-theme/type";

/** `surfaceRaised` → `--account-surface-raised`. */
const property = (key: string) => `--account-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

/**
 * The custom properties that dress the account screens in a company's look, and the interface pieces they are made
 * of (`@sharadox/interface-web-library`, `--interface-*`) with them.
 *
 * @example
 * accountThemeStyle({ accent: "var(--gold)" }); // { "--account-accent": "var(--gold)" }
 */
export function accountThemeStyle(theme: Partial<AccountThemeValues>): CSSProperties {
  return {
    ...(Object.fromEntries(Object.entries(theme).map(([key, value]) => [property(key), value])) as CSSProperties),
    ...interfaceThemeStyle(theme),
  };
}

/**
 * Wraps the account screens in a company's look (colors, corners, fonts), with no global stylesheet: the values sit
 * on this element as custom properties, which every account screen reads.
 *
 * @example
 * <AccountTheme theme={{ accent: "var(--gold)", font: "var(--font-body)" }}>{children}</AccountTheme>
 */
export function AccountTheme({ theme, children, className }: AccountThemeProperties) {
  return (
    <div className={className} style={accountThemeStyle(theme)}>
      {children}
    </div>
  );
}
