"use client";
import { useSyncExternalStore } from "react";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import type { TimeGreetingProperties } from "@sharadox/account-web-library/time-greeting/type";

/**
 * The part of the day at `hour` (0–23): morning from 5, afternoon from 12, evening from 18, night from 22.
 *
 * @example
 * partOfDay(9); // "morning"
 */
export function partOfDay(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

const never = () => () => {};

/**
 * "Good morning", "Good afternoon", "Good evening" or "Good night", by the visitor's own clock. The server doesn't
 * know it, so the words appear once the page runs in the browser (an empty space of the same height before).
 *
 * @example
 * <TimeGreeting locale="en" />
 */
export function TimeGreeting({ locale, className }: TimeGreetingProperties) {
  const hour = useSyncExternalStore(
    never,
    () => new Date().getHours(),
    () => null,
  );
  return (
    <span className={className} suppressHydrationWarning>
      {hour === null ? " " : say(ACCOUNT_WORDS.overview[partOfDay(hour)], locale)}
    </span>
  );
}
