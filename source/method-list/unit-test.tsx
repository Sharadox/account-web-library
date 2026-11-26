// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { MethodList } from "@sharadox/account-web-library/method-list";

afterEach(cleanup);

const METHODS = [
  { kind: "email" as const, id: "e", hint: "ana@example.com" },
  { kind: "authenticator" as const, id: "a", name: "Proton Pass", createdAt: "2026-11-25T10:00:00Z" },
];

test("every method side by side, each with its own button; a passed one is checked; a recovery code last", () => {
  const pick = vi.fn();
  render(<MethodList locale="en" methods={METHODS} done={["a"]} recoveryCode pending={null} onPick={pick} />);
  const rows = screen.getAllByRole("listitem");
  expect(rows.map((row) => row.textContent)).toEqual([
    "Code to ana@example.comSend Code",
    "Authenticator App: Proton PassConfirmed",
    "Recovery CodeEnter Code",
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Send Code" }));
  expect(pick).toHaveBeenLastCalledWith(METHODS[0]);
  fireEvent.click(screen.getByRole("button", { name: "Enter Code" }));
  expect(pick).toHaveBeenLastCalledWith({ kind: "recovery-code" });
  expect(screen.queryByRole("button", { name: /Proton Pass/ })).toBeNull();
});

test("a method on its way shows a loader on its button; an authenticator asks for its code", () => {
  const pick = vi.fn();
  const { rerender } = render(<MethodList locale="pt" methods={METHODS} pending="e" onPick={pick} />);
  const sending = screen.getByRole("button", { name: /A enviar/ });
  expect(sending.getAttribute("aria-busy")).toBe("true");
  // One at a time: the others wait.
  expect((screen.getByRole("button", { name: "Inserir Código" }) as HTMLButtonElement).disabled).toBe(true);
  rerender(<MethodList locale="pt" methods={METHODS} onPick={pick} />);
  fireEvent.click(screen.getByRole("button", { name: "Inserir Código" }));
  expect(pick).toHaveBeenCalledWith(METHODS[1]);
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});
