// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { AuthenticatorMethods } from "@sharadox/account-web-library/authenticator-methods";
import { openDialogs, renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
beforeAll(openDialogs);
afterEach(cleanup);

const phone = { id: "a1", name: "Phone", required: false, createdAt: "2026-11-20T10:00:00.000Z" };

const setUp = (left = 0, list = [phone]) => {
  const actions = {
    start: vi.fn(async (name: string) =>
      name === "Broken"
        ? { status: "refused" as const, reason: "name" }
        : { status: "done" as const, id: "a2", qr: "data:image/png;base64,AA", secret: "ABCDEFGHIJKLMNOP" },
    ),
    confirm: vi.fn(async (_id: string, code: string) =>
      code === "123456" ? { status: "done" as const } : { status: "refused" as const, reason: "wrong" },
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

test("each authenticator: required or not, renamed, removed", async () => {
  const actions = setUp();
  expect(screen.getByText("Phone")).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("switch")));
  expect(actions.setRequired).toHaveBeenCalledWith("a1", true);
  fireEvent.click(screen.getByRole("button", { name: "Rename" }));
  fireEvent.change(screen.getByLabelText("Name of this authenticator"), { target: { value: " " } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(screen.getByRole("alert").textContent).toBe("A name has 1 to 50 characters.");
  fireEvent.change(screen.getByLabelText("Name of this authenticator"), { target: { value: "Old phone" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(actions.rename).toHaveBeenCalledWith("a1", "Old phone");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Remove" })));
  expect(actions.remove).toHaveBeenCalledWith("a1");
});

test("adding one: its name, the QR code and key, the code it shows; then recovery codes are offered", async () => {
  const actions = setUp(0, []);
  expect(screen.queryByRole("list")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Add an authenticator app" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  fireEvent.click(screen.getByRole("button", { name: "Add an authenticator app" }));
  const name = () => screen.getByLabelText("Name of this authenticator");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(screen.getByRole("alert").textContent).toBe("A name has 1 to 50 characters.");
  fireEvent.change(name(), { target: { value: "Broken" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(screen.getByRole("alert").textContent).toBe("A name has 1 to 50 characters.");
  fireEvent.change(name(), { target: { value: "Tablet" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(actions.start).toHaveBeenLastCalledWith("Tablet");
  expect(screen.getByText("ABCD EFGH IJKL MNOP")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await paste("000000");
  expect(screen.getAllByRole("alert").some((alert) => alert.textContent === "That code isn't right.")).toBe(true);
  await paste("123456");
  expect(actions.confirm).toHaveBeenLastCalledWith("a2", "123456");
  expect(screen.getByText("Your authenticator is on. Make recovery codes now, in case you lose it?")).toBeTruthy();
  expect(actions.makeRecoveryCodes).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Make recovery codes" })));
  expect(screen.getByText("AAAA-BBBB")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Done." }));
  expect(screen.queryByText("AAAA-BBBB")).toBeNull();
});

test("Not now leaves recovery codes for later; with codes left nothing is offered; a setup can be cancelled", async () => {
  setUp(0, []);
  fireEvent.click(screen.getByRole("button", { name: "Add an authenticator app" }));
  fireEvent.change(screen.getByLabelText("Name of this authenticator"), { target: { value: "Tablet" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await paste("123456");
  fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  expect(screen.queryByText(/Make recovery codes now/)).toBeNull();
  cleanup();
  setUp(5, []);
  fireEvent.click(screen.getByRole("button", { name: "Add an authenticator app" }));
  fireEvent.change(screen.getByLabelText("Name of this authenticator"), { target: { value: "Tablet" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("button", { name: "Add an authenticator app" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Add an authenticator app" }));
  fireEvent.change(screen.getByLabelText("Name of this authenticator"), { target: { value: "Tablet" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await paste("123456");
  expect(screen.queryByText(/Make recovery codes now/)).toBeNull();
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
  expect(screen.getByText(/nov\.? de 2026|20\/11\/2026|nov/)).toBeTruthy();
});
