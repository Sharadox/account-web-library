// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { IdentifierPanel } from "@sharadox/account-web-library/identifier-panel";
import { renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
afterEach(cleanup);

const save = () => act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));

test("the identifier: the @ is its own part of the field, never sent; editing again starts from what was saved", async () => {
  const change = vi.fn(async (value: string) =>
    value === "taken" ? { status: "refused" as const, reason: "identifier-taken" } : { status: "done" as const },
  );
  renderAccountScreen(<IdentifierPanel locale="en" identifier="ana" change={change} />);
  expect(screen.getByText("@ana")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  const field = screen.getByLabelText("Identifier");
  expect(field.parentElement!.firstElementChild!.textContent).toBe("@");
  fireEvent.change(field, { target: { value: "a--b" } });
  await save();
  expect(screen.getByRole("alert").textContent).toContain("Use letters and digits");
  fireEvent.change(field, { target: { value: "taken" } });
  await save();
  expect(screen.getByRole("alert").textContent).toBe("That identifier is taken. Try another.");
  fireEvent.change(field, { target: { value: "@Ana-Silva" } });
  await save();
  expect(change).toHaveBeenLastCalledWith("Ana-Silva");
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  expect((screen.getByLabelText("Identifier") as HTMLInputElement).value).toBe("Ana-Silva");
});

test("while the identifier is on its way: a skeleton, and Edit waits", () => {
  renderAccountScreen(<IdentifierPanel locale="en" change={async () => ({ status: "done" })} />);
  expect(screen.getByRole("status", { name: "Loading…" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Edit" }) as HTMLButtonElement).disabled).toBe(true);
});
