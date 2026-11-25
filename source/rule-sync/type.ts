import type { PenaltySchedule } from "@sharadox/account-web-library/ban-length/type";

/** A public rule as an application declares it. */
export interface RuleDeclaration {
  code: string;
  /** In each language: `{ en, pt }`. */
  title: Record<string, string>;
  description: Record<string, string>;
  /** Penalties for the 1st, 2nd… offense: seconds, or "permanent"; the last repeats. */
  schedule: PenaltySchedule;
}

/** A rule's newest version, as `/rules` shows it. */
export interface PublishedRule extends RuleDeclaration {
  version: number;
  /** For every application. */
  global: boolean;
}
