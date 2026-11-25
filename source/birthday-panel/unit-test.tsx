// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { BirthdayPanel } from "@sharadox/account-web-library/birthday-panel";
import { renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
afterEach(cleanup);

const save = () => act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));

test("none yet: Add, then day and month (the year optional), checked here", async () => {
  const saved = vi.fn(async () => ({ status: "done" as const }));
  renderAccountScreen(<BirthdayPanel locale="en" birthday={null} save={saved} />);
  expect(screen.getByText("Not given.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Remove birthday" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  fireEvent.change(screen.getByLabelText("Day"), { target: { value: "31" } });
  fireEvent.change(screen.getByLabelText("Month"), { target: { value: "4" } });
  await save();
  expect(screen.getByRole("alert").textContent).toBe("That date doesn't exist.");
  fireEvent.change(screen.getByLabelText("Day"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Year (optional)"), { target: { value: "2020" } });
  await save();
  expect(screen.getByRole("alert").textContent).toBe("Accounts are for people 16 and older.");
  fireEvent.change(screen.getByLabelText("Year (optional)"), { target: { value: "" } });
  await save();
  expect(saved).toHaveBeenCalledWith({ day: 3, month: 4, year: null });
});

test("one given: shown in words, edited with its year, or removed", async () => {
  const saved = vi.fn(async () => ({ status: "done" as const }));
  renderAccountScreen(<BirthdayPanel locale="pt" birthday={{ day: 3, month: 7, year: 1990 }} save={saved} />);
  expect(screen.getByText("3 julho 1990")).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Remover aniversário" })));
  expect(saved).toHaveBeenCalledWith(null);
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Guardar" })));
  expect(saved).toHaveBeenLastCalledWith({ day: 3, month: 7, year: 1990 });
});

test("a birthday without a year shows day and month only", () => {
  renderAccountScreen(<BirthdayPanel locale="en" birthday={{ day: 29, month: 2, year: null }} save={vi.fn()} />);
  expect(screen.getByText("29 February")).toBeTruthy();
});
