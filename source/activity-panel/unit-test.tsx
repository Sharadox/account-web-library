// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ActivityPanel, activityText } from "@sharadox/account-web-library/activity-panel";

afterEach(cleanup);

test("each event in words with its time, in a list that scrolls; or nothing yet", () => {
  const { rerender } = render(
    <ActivityPanel
      locale="en"
      activity={[
        { id: "1", at: "2026-11-25T10:00:00.000Z", action: "authenticator.added" },
        { id: "2", at: "2026-11-24T10:00:00.000Z", action: "something.new" },
      ]}
    />,
  );
  const list = screen.getByRole("list", { name: "Activity" });
  expect(list.getAttribute("tabindex")).toBe("0");
  expect(screen.getByText("Authenticator App Added")).toBeTruthy();
  expect(screen.getByText("something.new")).toBeTruthy();
  rerender(<ActivityPanel locale="pt" activity={[]} />);
  expect(screen.getByText("Ainda nada.")).toBeTruthy();
  expect(activityText("contact.added", "pt")).toBe("Email Adicionado");
});

test("while the activity is on its way, rows of value skeletons, not the empty line", () => {
  const { container } = render(<ActivityPanel locale="en" />);
  expect(container.querySelector("ol[aria-busy=true]")!.querySelectorAll("li")).toHaveLength(5);
  expect(screen.getAllByRole("status", { name: "Loading…" })).toHaveLength(1);
  expect(screen.queryByText("Nothing yet.")).toBeNull();
});
