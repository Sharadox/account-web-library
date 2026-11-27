// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AppealAdministration } from "@sharadox/account-web-library/appeal-administration";
import { renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
afterEach(cleanup);

const appeal = {
  appealId: "p1",
  identifier: "ana",
  statement: "Spam.",
  text: "Not spam.",
  createdAt: "2026-11-25T10:00:00.000Z",
};

test("decides an appeal with its reasons; shortening takes a date", async () => {
  const decide = vi.fn(async () => ({ status: "done" as const }));
  renderAccountScreen(<AppealAdministration locale="en" appeals={[appeal]} decide={decide} />);
  expect(screen.getByText("Not spam.")).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Lift" })));
  expect(screen.getByRole("alert").textContent).toContain("Something went wrong.");
  fireEvent.change(screen.getByLabelText("Reasons for the Decision (the Account Sees Them)"), {
    target: { value: "Fair." },
  });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Lift" })));
  expect(decide).toHaveBeenLastCalledWith({ appealId: "p1", decision: "lifted", reasons: "Fair." });
  fireEvent.change(screen.getByLabelText("New End (To Shorten)"), { target: { value: "2026-12-01" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Shorten" })));
  expect(decide).toHaveBeenLastCalledWith({
    appealId: "p1",
    decision: "shortened",
    reasons: "Fair.",
    endsAt: "2026-12-01",
  });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Keep the Ban" })));
  expect(decide).toHaveBeenLastCalledWith({ appealId: "p1", decision: "upheld", reasons: "Fair." });
});

test("none waiting", () => {
  renderAccountScreen(<AppealAdministration locale="en" appeals={[]} decide={vi.fn()} />);
  expect(screen.getByText("No appeals waiting.")).toBeTruthy();
});

test("while the appeals are on their way, one card of value skeletons, not the empty line", () => {
  renderAccountScreen(<AppealAdministration locale="en" decide={vi.fn()} />);
  expect(screen.getAllByRole("status", { name: "Loading…" })).toHaveLength(1);
  expect(screen.queryByText("No appeals waiting.")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});
