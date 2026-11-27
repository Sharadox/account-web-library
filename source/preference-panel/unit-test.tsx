// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { PreferencePanel } from "@sharadox/account-web-library/preference-panel";
import { renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
afterEach(cleanup);

const preferences = [
  {
    kind: "new-sign-in" as const,
    security: true,
    channels: { "in-app": { enabled: true, locked: false }, email: { enabled: false, locked: false } },
  },
  {
    kind: "inactivity-warning" as const,
    security: false,
    channels: { "in-app": { enabled: true, locked: false }, email: { enabled: true, locked: true } },
  },
];

test("shows each kind's channels; Edit turns them into checkboxes, locked ones fixed; Save sends every choice", async () => {
  const save = vi.fn(async () => ({ status: "done" as const }));
  renderAccountScreen(<PreferencePanel locale="en" preferences={preferences} save={save} />);
  expect(screen.getByText("Always On")).toBeTruthy();
  expect(screen.getAllByText("No")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  const locked = screen.getByRole("checkbox", {
    name: "Your Account Will Be Deleted for Inactivity: Email",
  }) as HTMLInputElement;
  expect(locked.disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "New Sign-In on a Browser Not Used Before: Email" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(save).toHaveBeenCalledWith([
    { kind: "new-sign-in", channel: "in-app", enabled: true },
    { kind: "new-sign-in", channel: "email", enabled: true },
    { kind: "inactivity-warning", channel: "in-app", enabled: true },
  ]);
});

test("while the preferences are on their way, the card, its text and the table's head show, the rows are skeletons and Edit waits", () => {
  const { container } = renderAccountScreen(<PreferencePanel locale="en" save={vi.fn()} />);
  expect(screen.getByRole("columnheader", { name: "Email" })).toBeTruthy();
  expect(container.querySelector("tbody[aria-busy=true]")!.querySelectorAll("tr")).toHaveLength(4);
  expect(screen.getAllByRole("status", { name: "Loading…" })).toHaveLength(1);
  expect((screen.getByRole("button", { name: /Edit/ }) as HTMLButtonElement).disabled).toBe(true);
});
