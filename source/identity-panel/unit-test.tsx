// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { IdentityPanel } from "@sharadox/account-web-library/identity-panel";
import { renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
afterEach(cleanup);

const setUp = () => {
  const changeName = vi.fn(async () => ({ status: "done" as const }));
  const changeIdentifier = vi.fn(async (value: string) =>
    value === "taken" ? { status: "refused" as const, reason: "identifier-taken" } : { status: "done" as const },
  );
  renderAccountScreen(
    <IdentityPanel
      locale="en"
      name="Ana"
      identifier="ana"
      changeName={changeName}
      changeIdentifier={changeIdentifier}
    />,
  );
  return { changeName, changeIdentifier };
};

const save = () => act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));

test("the name: read-only, then edited, checked here, and saved", async () => {
  const { changeName } = setUp();
  expect(screen.getByText("Ana")).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]!);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "   " } });
  await save();
  expect(screen.getByRole("alert").textContent).toBe("A name has 1 to 50 characters.");
  expect(changeName).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: " Ana Silva " } });
  await save();
  expect(changeName).toHaveBeenCalledWith("Ana Silva");
});

test("the identifier: the @ is its own part of the field, never sent", async () => {
  const { changeIdentifier } = setUp();
  expect(screen.getByText("@ana")).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]!);
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
  expect(changeIdentifier).toHaveBeenLastCalledWith("Ana-Silva");
});
