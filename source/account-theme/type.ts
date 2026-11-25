import type { ReactNode } from "react";

/** A company's look for the account screens; anything left out keeps its plain default. */
export interface AccountThemeValues {
  background: string;
  /** Behind cards and panels. */
  surface: string;
  /** Cards, menus, dialogs. */
  surfaceRaised: string;
  text: string;
  /** Labels, hints, secondary text. */
  textSoft: string;
  line: string;
  /** Buttons, links, focus rings, selection. */
  accent: string;
  /** Text on the accent. */
  accentText: string;
  danger: string;
  success: string;
  radius: string;
  smallRadius: string;
  font: string;
  /** Headings. */
  fontDisplay: string;
  /** The height of the site's fixed bar: notifications sit just below it. */
  barHeight: string;
  shadow: string;
}

export interface AccountThemeProperties {
  theme: Partial<AccountThemeValues>;
  children: ReactNode;
  className?: string;
}
