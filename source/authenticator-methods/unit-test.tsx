// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { AuthenticatorMethods } from "@sharadox/account-web-library/authenticator-methods";
import { openDialogs, renderAccountScreen } from "@sharadox/account-web-library/test-screen";

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

test("each authenticator: called by its name or the day it was added; required or not, renamed, removed", async () => {
  const actions = setUp(0, [phone, unnamed]);
  expect(screen.getByText("Phone")).toBeTruthy();
  expect(screen.getByText("Added 21 Nov 2026")).toBeTruthy();
  await act(async () => fireEvent.click(screen.getAllByRole("switch")[0]!));
  expect(actions.setRequired).toHaveBeenCalledWith("a1", true);
  expect(screen.getAllByRole("switch")[0]!.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[0]!);
  fireEvent.change(screen.getByLabelText("Name (optional)"), { target: { value: "x".repeat(51) } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(screen.getByRole("alert").textContent).toBe("A name has 1 to 50 characters.");
  fireEvent.change(screen.getByLabelText("Name (optional)"), { target: { value: "Old phone" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(actions.rename).toHaveBeenCalledWith("a1", "Old phone");
  expect(screen.getByText("Old phone")).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[1]!);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(actions.rename).toHaveBeenLastCalledWith("a3", "");
  await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!));
  expect(actions.remove).toHaveBeenCalledWith("a1");
});

test("a switch whose change fails flips back", async () => {
  const actions = setUp();
  actions.setRequired.mockResolvedValueOnce({ status: "refused", reason: "generic" } as never);
  await act(async () => fireEvent.click(screen.getByRole("switch")));
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
});

test("adding one: the QR code at once, the key on request, an optional name, the code; then recovery codes", async () => {
  const actions = setUp(0, []);
  expect(screen.queryByRole("list")).toBeNull();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add an authenticator app" })));
  expect(actions.start).toHaveBeenCalledOnce();
  expect(screen.getByRole("img", { name: "QR code" })).toBeTruthy();
  expect(screen.queryByText("ABCD EFGH IJKL MNOP")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "I'd rather type the key" }));
  expect(screen.getByText("ABCD EFGH IJKL MNOP")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "I'd rather type the key" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Name (optional)"), { target: { value: "x".repeat(51) } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await paste("123456");
  expect(screen.getAllByRole("alert").some((alert) => alert.textContent === "A name has 1 to 50 characters.")).toBe(
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.change(screen.getByLabelText("Name (optional)"), { target: { value: " Tablet " } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await paste("000000");
  expect(screen.getAllByRole("alert").some((alert) => alert.textContent === "That code isn't right.")).toBe(true);
  await paste("123456");
  expect(actions.confirm).toHaveBeenLastCalledWith("a2", "123456", "Tablet");
  expect(screen.getByText("Your authenticator is on. Make recovery codes now, in case you lose it?")).toBeTruthy();
  expect(actions.makeRecoveryCodes).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Make recovery codes" })));
  expect(screen.getByText("AAAA-BBBB")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Done." }));
  expect(screen.queryByText("AAAA-BBBB")).toBeNull();
});

test("Not now leaves recovery codes for later; with codes left nothing is offered; a setup can be cancelled", async () => {
  const actions = setUp(0, []);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add an authenticator app" })));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await paste("123456");
  expect(actions.confirm).toHaveBeenLastCalledWith("a2", "123456", "");
  fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  expect(screen.queryByText(/Make recovery codes now/)).toBeNull();
  cleanup();
  setUp(5, []);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add an authenticator app" })));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("button", { name: "Add an authenticator app" })).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add an authenticator app" })));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await paste("123456");
  expect(screen.queryByText(/Make recovery codes now/)).toBeNull();
});

test("a setup that can't start is explained", async () => {
  setUp(0, [], true);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add an authenticator app" })));
  expect(screen.queryByRole("img", { name: "QR code" })).toBeNull();
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
