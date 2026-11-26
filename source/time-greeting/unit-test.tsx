// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { partOfDay, TimeGreeting } from "@sharadox/account-web-library/time-greeting";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test("the part of the day by the hour", () => {
  expect([4, 5, 11, 12, 17, 18, 21, 22, 0].map(partOfDay)).toEqual([
    "night",
    "morning",
    "morning",
    "afternoon",
    "afternoon",
    "evening",
    "evening",
    "night",
    "night",
  ]);
});

test("greets by the visitor's clock, in their language; nothing from the server", () => {
  vi.useFakeTimers({ now: new Date(2026, 10, 26, 9, 0) });
  render(<TimeGreeting locale="en" className="x" />);
  expect(screen.getByText("Good Morning,").className).toBe("x");
  cleanup();
  vi.setSystemTime(new Date(2026, 10, 26, 23, 0));
  render(<TimeGreeting locale="pt" />);
  expect(screen.getByText("Boa Noite,")).toBeTruthy();
  expect(renderToString(<TimeGreeting locale="en" />)).not.toContain("Good");
});
