/** A rule's penalties for the 1st, 2nd, 3rd… offense: seconds, or "permanent". The last one repeats. */
export type PenaltySchedule = Array<number | "permanent">;

/** One broken rule: its schedule and how many times the account broke it before (in that application). */
export interface BrokenRule {
  schedule: PenaltySchedule;
  previousOffenses: number;
}
