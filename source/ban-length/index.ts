import type { BrokenRule } from "@sharadox/account-web-library/ban-length/type";

/**
 * How long a ban lasts, from the rules it cites, so equal offenses get equal penalties:
 * - each rule gives the penalty of its schedule for this offense (1st, 2nd…), and the last penalty repeats;
 * - several rules broken at once give the longest of their penalties.
 *
 * @example
 * banLength([{ schedule: [7 * 86_400, 30 * 86_400, "permanent"], previousOffenses: 1 }]); // 2_592_000 (30 days)
 */
export function banLength(rules: BrokenRule[]): number | "permanent" {
  if (rules.length === 0) throw new Error("a ban must cite at least one rule");
  const penalties = rules.map(({ schedule, previousOffenses }) => {
    if (schedule.length === 0) throw new Error("a rule has no penalty");
    return schedule[Math.min(previousOffenses, schedule.length - 1)]!;
  });
  if (penalties.includes("permanent")) return "permanent";
  return Math.max(...(penalties as number[]));
}
