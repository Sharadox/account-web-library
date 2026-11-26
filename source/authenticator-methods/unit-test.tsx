// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { AuthenticatorMethods } from "@sharadox/account-web-library/authenticator-methods";
import { endDialogAnimations, openDialogs, renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
beforeAll(openDialogs);
afterEach(cleanup);

const phone = { id: "a1", name: "Phone", required: false, createdAt: "2026-11-20T10:00:00.000Z" };
const unnamed = { id: "a3", name: null, required: true, createdAt: "2026-11-21T10:00:00.000Z" };

const setUp = (left = 0, list: (typeof phone | typeof unnamed)[] = [phone], refuseStart = false) => {
  const actions = {
    start: vi.fn(async () =>
      refuseStart
        ? { status: "refused" as const, reason: "odd" }
        : { status: "done" as const, id: "a2", qr: "data:image/png;base64,AA", secret: "ABCDEFGHIJKLMNOP" },
    ),
    confirm: vi.fn(async (_id: string, code: string, name: string) =>
      code !== "123456"
        ? { status: "refused" as const, reason: "wrong" }
        : name.length > 50
          ? { status: "refused" as const, reason: "name" }
          : { status: "done" as const },
    ),
    rename: vi.fn(async () => ({ status: "done" as const })),
    remove: vi.fn(async () => ({ status: "done" as const })),
    setRequired: vi.fn(async () => ({ status: "done" as const })),
    makeRecoveryCodes: vi.fn(async () => ({ status: "done" as const, recoveryCodes: ["AAAA-BBBB"] })),
  };
  renderAccountScreen(
    <AuthenticatorMethods locale="en" company="Acme" authenticators={list} recoveryCodesLeft={left} {...actions} />,
  );
  return actions;
};

const paste = (text: string) =>
  act(
    async () =>
      void fireEvent.paste(screen.getAllByRole("textbox").at(-6)!, { clipboardData: { getData: () => text } }),
  );

test("each authenticator: its name with the day it was added; required (before Remove) or not, renamed, removed", async () => {
  const actions = setUp(0, [phone, unnamed]);
  expect(screen.getByText("Phone")).toBeTruthy();
  expect(screen.getByText("Added 21 Nov 2026")).toBeTruthy();
  expect(screen.getByText("No Name")).toBeTruthy();
  const first = screen.getAllByRole("listitem")[0]!;
  const controls = Array.from(first.querySelectorAll("button")).map(
    (button) => button.getAttribute("role") ?? button.textContent,
  );
  expect(controls).toEqual(["switch", "Remove", "Rename"]);
  await act(async () => fireEvent.click(screen.getAllByRole("switch")[0]!));
  expect(actions.setRequired).toHaveBeenCalledWith("a1", true);
  expect(screen.getAllByRole("switch")[0]!.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[0]!);
  expect(screen.getByLabelText("Name").getAttribute("placeholder")).toBe("Google Authenticator, Proton Pass, etc.");
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "x".repeat(51) } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(screen.getByRole("alert").textContent).toBe("A name has 1 to 50 characters.");
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Old phone" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(actions.rename).toHaveBeenCalledWith("a1", "Old phone");
  expect(screen.getByText("Old phone")).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[0]!);
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Old phone");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  // An empty name isn't saved.
  fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[1]!);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(screen.getByRole("alert").textContent).toBe("A name has 1 to 50 characters.");
  expect(actions.rename).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!));
  expect(actions.remove).toHaveBeenCalledWith("a1");
});

test("a switch whose change fails flips back", async () => {
  const actions = setUp();
  actions.setRequired.mockResolvedValueOnce({ status: "refused", reason: "generic" } as never);
  await act(async () => fireEvent.click(screen.getByRole("switch")));
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
});

test("adding one: the QR code at once, the key on request, a name, required or not, the code; then recovery codes", async () => {
  const actions = setUp(0, []);
  expect(screen.queryByRole("list")).toBeNull();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add an Authenticator App" })));
  expect(actions.start).toHaveBeenCalledOnce();
  expect(screen.getByRole("img", { name: "QR Code" })).toBeTruthy();
  expect(screen.queryByText("ABCD EFGH IJKL MNOP")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "I'd Rather Type the Key" }));
  expect(screen.getByText("ABCD EFGH IJKL MNOP")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "I'd Rather Type the Key" })).toBeNull();
  // A name first: none, or one too long, is explained on the field before any code is asked for.
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(screen.getByRole("alert").textContent).toBe("Give it a name first.");
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "x".repeat(51) } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(screen.getByRole("alert").textContent).toBe("A name has 1 to 50 characters.");
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: " Tablet " } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Required at Every Sign-In" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await paste("000000");
  expect(screen.getAllByRole("alert").some((alert) => alert.textContent === "That code isn't right.")).toBe(true);
  await paste("123456");
  expect(actions.confirm).toHaveBeenLastCalledWith("a2", "123456", "Tablet", true);
  expect(screen.getByText("Your authenticator is on. Make recovery codes now, in case you lose it?")).toBeTruthy();
  expect(actions.makeRecoveryCodes).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Make Recovery Codes" })));
  expect(screen.getByText("AAAA-BBBB")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Done." }));
  expect(screen.queryByText("AAAA-BBBB")).toBeNull();
});

test("Not now leaves recovery codes for later; with codes left nothing is offered; a setup can be cancelled", async () => {
  const actions = setUp(0, []);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add an Authenticator App" })));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Proton Pass" } });
  // The code pop-up can be closed and opened again.
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
  act(endDialogAnimations);
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await paste("123456");
  expect(actions.confirm).toHaveBeenLastCalledWith("a2", "123456", "Proton Pass", false);
  fireEvent.click(screen.getByRole("button", { name: "Not Now" }));
  act(endDialogAnimations);
  expect(screen.queryByText(/Make recovery codes now/)).toBeNull();
  cleanup();
  setUp(5, []);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add an Authenticator App" })));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("button", { name: "Add an Authenticator App" })).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add an Authenticator App" })));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Phone" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await paste("123456");
  act(endDialogAnimations);
  expect(screen.queryByText(/Make recovery codes now/)).toBeNull();
  cleanup();
  // While the list is on its way: a skeleton, and Add waits.
  renderAccountScreen(<AuthenticatorMethods locale="en" company="Acme" {...actions} />);
  expect(screen.getByRole("status", { name: "Loading…" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Add an Authenticator App" }) as HTMLButtonElement).disabled).toBe(true);
});

test("a setup that can't start is explained", async () => {
  setUp(0, [], true);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add an Authenticator App" })));
  expect(screen.queryByRole("img", { name: "QR Code" })).toBeNull();
  expect(screen.getByRole("alert").textContent).toBe("Something went wrong. Please try again.");
});

test("dates in Portuguese", () => {
  renderAccountScreen(
    <AuthenticatorMethods
      locale="pt"
      company="Acme"
      authenticators={[phone]}
      recoveryCodesLeft={1}
      start={vi.fn()}
      confirm={vi.fn()}
      rename={vi.fn()}
      remove={vi.fn()}
      setRequired={vi.fn()}
      makeRecoveryCodes={vi.fn()}
    />,
  );
  expect(screen.getByText("Adicionada a 20/11/2026")).toBeTruthy();
});
