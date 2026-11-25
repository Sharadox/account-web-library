/** A birthday: day and month, and the year only if its owner wants to give it. */
export interface Birthday {
  day: number;
  month: number;
  year?: number | null;
}

/** `date`: no such day; `age`: with that year, younger than the minimum age. */
export type BirthdayCheck = { valid: true } | { valid: false; reason: "date" | "age" };
