// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { EmailMethods } from "@sharadox/account-web-library/email-methods";
import { openDialogs, renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
beforeAll(openDialogs);
afterEach(cleanup);

const emails = [
  { id: "c1", value: "ana@example.com", verified: true, required: true },
  { id: "c2", value: "pending@example.com", verified: false, required: false },
];

const setUp = () => {
  const actions = {
    add: vi.fn(async (email: string) =>
      email === "taken@example.com"
        ? { status: "refused" as const, reason: "contact-taken" }
        : { status: "done" as const, requestId: email === "again@example.com" ? "r2" : "r1" },
    ),
    verify: vi.fn(async (_request: string, code: string) =>
      code === "123456" ? { status: "done" as const } : { status: "refused" as const, reason: "wrong" },
    ),
    remove: vi.fn(async () => ({ status: "done" as const })),
    setRequired: vi.fn(async () => ({ status: "done" as const })),
  };
  renderAccountScreen(<EmailMethods locale="en" emails={emails} {...actions} />);
  return actions;
};

const paste = (text: string) =>
  act(
    async () =>
      void fireEvent.paste(screen.getAllByRole("textbox").at(-6)!, { clipboardData: { getData: () => text } }),
  );

test("lists the emails; a verified one can be required; any can be removed", async () => {
  const actions = setUp();
  expect(screen.getAllByRole("switch")).toHaveLength(1);
  await act(async () => fireEvent.click(screen.getByRole("switch", { name: "Required at every sign-in" })));
  expect(actions.setRequired).toHaveBeenCalledWith("c1", false);
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  actions.setRequired.mockResolvedValueOnce({ status: "refused", reason: "generic" } as never);
  await act(async () => fireEvent.click(screen.getByRole("switch")));
  expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  let finish: () => void = () => {};
  actions.remove.mockImplementationOnce(
    () => new Promise((resolve) => (finish = () => resolve({ status: "done" as const }))),
  );
  fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]!);
  expect(actions.remove).toHaveBeenCalledWith("c2");
  expect(screen.getByRole("button", { name: "Removing…" })).toBeTruthy();
  expect(screen.getAllByRole("listitem")[1]!.getAttribute("aria-busy")).toBe("true");
  await act(async () => finish());
  expect(screen.queryByRole("button", { name: "Removing…" })).toBeNull();
});

test("Add an email shows its field with Save and Cancel; Save sends a code to verify it", async () => {
  const actions = setUp();
  expect(screen.queryByRole("textbox", { name: "Add an email" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Add an email" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Add an email" }));
  const field = () => screen.getByRole("textbox", { name: "Add an email" });
  fireEvent.change(field(), { target: { value: "nope" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(screen.getByRole("alert").textContent).toBe("That email doesn't look right.");
  fireEvent.change(field(), { target: { value: "taken@example.com" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(screen.getByRole("alert").textContent).toBe("That email belongs to another account.");
  fireEvent.change(field(), { target: { value: "New@Example.com" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(actions.add).toHaveBeenLastCalledWith("new@example.com");
  expect(screen.getByRole("heading", { name: "Check Your Email" })).toBeTruthy();
  await paste("000000");
  expect(screen.getAllByRole("alert").some((alert) => alert.textContent === "That code isn't right.")).toBe(true);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send a new code" })));
  expect(actions.add).toHaveBeenCalledTimes(3);
  await paste("123456");
  expect(actions.verify).toHaveBeenLastCalledWith("r1", "123456", false);
  expect(screen.queryByRole("heading", { name: "Check Your Email" })).toBeNull();
});

test("a resend that's refused is notified; closing the pop-up leaves the email unverified", async () => {
  const actions = setUp();
  fireEvent.click(screen.getByRole("button", { name: "Add an email" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Add an email" }), { target: { value: "x@example.com" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  actions.add.mockResolvedValueOnce({ status: "refused", reason: "rate-limit" } as never);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send a new code" })));
  expect(screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("Too many tries."))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("heading", { name: "Check Your Email" })).toBeNull();
});

test("a new email can be required at every sign-in from the start", async () => {
  const actions = setUp();
  fireEvent.click(screen.getByRole("button", { name: "Add an email" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Add an email" }), { target: { value: "w@example.com" } });
  const choice = screen.getByRole("checkbox", { name: "Required at every sign-in" });
  expect((choice as HTMLInputElement).checked).toBe(false);
  fireEvent.click(choice);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  await paste("123456");
  expect(actions.verify).toHaveBeenLastCalledWith("r1", "123456", true);
});
