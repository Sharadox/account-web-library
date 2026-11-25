import type { ReactNode } from "react";
import type { InterfaceThemeValues } from "@sharadox/interface-web-library/interface-theme/type";

/** A company's look for the account screens (the interface pieces' values); anything left out keeps its default. */
export type AccountThemeValues = InterfaceThemeValues;

export interface AccountThemeProperties {
  theme: Partial<AccountThemeValues>;
  children: ReactNode;
  className?: string;
}
