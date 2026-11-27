// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { DeletionPanel } from "@sharadox/account-web-library/deletion-panel";
import { endDialogAnimations, openDialogs, renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
beforeAll(openDialogs);
afterEach(cleanup);

test("asks for the identifier first; only the right one deletes", async () => {
  const remove = vi.fn(async () => ({ status: "refused" as const, reason: "generic" }));
  renderAccountScreen(<DeletionPanel locale="en" identifier="Ana" remove={remove} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));
  const field = screen.getByLabelText("Type Your Identifier to Confirm");
  fireEvent.change(field, { target: { value: "bea" } });
  const submit = () =>
    act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Delete My Account" }).at(-1)!));
  await submit();
  expect(screen.getByRole("alert").textContent).toBe("That isn't your identifier.");
  expect(remove).not.toHaveBeenCalled();
  fireEvent.change(field, { target: { value: "@ana" } });
  await submit();
  expect(remove).toHaveBeenCalledOnce();
  expect(screen.getByRole("alert").textContent).toContain("Something went wrong.");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  act(endDialogAnimations);
  expect(screen.queryByLabelText("Type Your Identifier to Confirm")).toBeNull();
});

test("while the identifier is on its way, the card shows and Delete waits", () => {
  renderAccountScreen(<DeletionPanel locale="en" remove={vi.fn()} />);
  expect((screen.getByRole("button", { name: "Delete My Account" }) as HTMLButtonElement).disabled).toBe(true);
});
