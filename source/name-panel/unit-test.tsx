// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { NamePanel } from "@sharadox/account-web-library/name-panel";
import { renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
afterEach(cleanup);

const save = () => act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));

test("the name in its own card: read-only, then edited, checked here, saved; editing again starts from it", async () => {
  const change = vi.fn(async () => ({ status: "done" as const }));
  renderAccountScreen(<NamePanel locale="en" name="Ana" change={change} />);
  expect(screen.getByText("Ana")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "   " } });
  await save();
  expect(screen.getByRole("alert").textContent).toBe("A name has 1 to 50 characters.");
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: " Ana Silva " } });
  await save();
  expect(change).toHaveBeenCalledWith("Ana Silva");
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(" Ana Silva ");
});

test("while the name is on its way: a skeleton, and Edit waits", () => {
  renderAccountScreen(<NamePanel locale="en" change={async () => ({ status: "done" })} />);
  expect(screen.getByRole("status", { name: "Loading…" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Edit" }) as HTMLButtonElement).disabled).toBe(true);
});
