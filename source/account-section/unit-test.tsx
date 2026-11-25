// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { AccountSection } from "@sharadox/account-web-library/account-section";

afterEach(cleanup);

test("a section of an area's page: its heading names it, its id is where jumps land", () => {
  render(
    <AccountSection id="devices" title="Devices" description="Where you're signed in.">
      <p>List</p>
    </AccountSection>,
  );
  const section = screen.getByRole("region", { name: "Devices" });
  expect(section.id).toBe("devices");
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Devices");
  expect(section.textContent).toContain("Where you're signed in.");
});

test("a section can go without a heading of its own (the only one on its page)", () => {
  render(
    <AccountSection id="summary" title="Summary" hideTitle>
      <p>List</p>
    </AccountSection>,
  );
  expect(screen.queryByRole("heading")).toBeNull();
  expect(screen.getByRole("region", { name: "Summary" })).toBeTruthy();
});
