import { expect, test } from "vitest";
import { banLength } from "@sharadox/account-web-library/ban-length";

const day = 86_400;
const spam = { schedule: [7 * day, 30 * day, "permanent" as const] };
const rudeness = { schedule: [day, 7 * day] };

test("a first offense gets the first penalty of the schedule", () => {
  expect(banLength([{ ...spam, previousOffenses: 0 }])).toBe(7 * day);
});

test("repeat offenses climb the schedule, the same for everyone", () => {
  expect(banLength([{ ...spam, previousOffenses: 1 }])).toBe(30 * day);
  expect(banLength([{ ...spam, previousOffenses: 2 }])).toBe("permanent");
});

test("past the end of the schedule, its last penalty applies", () => {
  expect(banLength([{ ...rudeness, previousOffenses: 9 }])).toBe(7 * day);
});

test("several rules broken at once: the longest penalty", () => {
  expect(
    banLength([
      { ...rudeness, previousOffenses: 0 },
      { ...spam, previousOffenses: 0 },
    ]),
  ).toBe(7 * day);
  expect(
    banLength([
      { ...rudeness, previousOffenses: 1 },
      { ...spam, previousOffenses: 2 },
    ]),
  ).toBe("permanent");
});

test("a ban must cite at least one rule, each with a penalty", () => {
  expect(() => banLength([])).toThrow("at least one rule");
  expect(() => banLength([{ schedule: [], previousOffenses: 0 }])).toThrow("no penalty");
});
