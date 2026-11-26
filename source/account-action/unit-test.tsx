// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { AccountActions, useAccountAction } from "@sharadox/account-web-library/account-action";
import type { AccountAnswer, StepUp } from "@sharadox/account-web-library/account-action/type";
import { ToastProvider } from "@sharadox/interface-web-library/toast";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  refresh.mockClear();
});

const paste = (text: string) =>
  fireEvent.paste(screen.getAllByRole("textbox")[0]!, { clipboardData: { getData: () => text } });

function Runner({ action, form }: { action: () => Promise<AccountAnswer<{ value?: number }>>; form?: boolean }) {
  const { run, submit, pending } = useAccountAction();
  return (
    <>
      <button
        onClick={async () => {
          const answer = form
            ? await submit(action, { refresh: false })
            : await run(action, { success: "Done.", onDone: () => {} });
          document.body.dataset.answer = JSON.stringify(answer);
        }}
      >
        go
      </button>
      <span>{pending ? "busy" : "idle"}</span>
    </>
  );
}

const setUp = (action: () => Promise<AccountAnswer<{ value?: number }>>, stepUp: Partial<StepUp> = {}, form = false) =>
  render(
    <ToastProvider label="Notifications" dismissLabel="Dismiss">
      <AccountActions
        locale="en"
        company="Luis Pires Decor"
        stepUp={{
          methods: async () => ({
            status: "done",
            ticket: "t0",
            mode: "one",
            methods: [
              { kind: "email", id: "e", hint: "ana@example.com" },
              { kind: "authenticator", id: "a", name: "Proton Pass", createdAt: "2026-11-25T10:00:00Z" },
            ],
            recoveryCode: true,
          }),
          send: async () => ({ status: "done", requestId: "r" }),
          finish: async (_ticket, step) =>
            step.code === "123456" ? { status: "done" } : { status: "refused", reason: "wrong" },
          ...stepUp,
        }}
      >
        <Runner action={action} form={form} />
      </AccountActions>
    </ToastProvider>,
  );

test("done: a notification, the page read again, the answer given back", async () => {
  setUp(async () => ({ status: "done", value: 7 }));
  await act(async () => fireEvent.click(screen.getByText("go")));
  expect(screen.getByRole("status").textContent).toContain("Done.");
  expect(refresh).toHaveBeenCalledOnce();
  expect(JSON.parse(document.body.dataset.answer!)).toEqual({ status: "done", value: 7 });
});

test("refused: the reason explained as an error; a thrown action is a general error", async () => {
  setUp(async () => ({ status: "refused", reason: "identifier-taken" }));
  await act(async () => fireEvent.click(screen.getByText("go")));
  expect(screen.getByRole("alert").textContent).toContain("That identifier is taken.");
  expect(document.body.dataset.answer).toBe("null");
  cleanup();
  setUp(async () => {
    throw new Error("down");
  });
  await act(async () => fireEvent.click(screen.getByText("go")));
  expect(screen.getByRole("alert").textContent).toContain("Something went wrong.");
});

test("a change that needs confirming lists every way, equally; the one picked asks for its code, then it runs again", async () => {
  let calls = 0;
  const send = vi.fn(async () => ({ status: "done" as const, requestId: "r" }));
  setUp(async () => (++calls === 1 ? { status: "step-up" } : { status: "done" }), { send });
  await act(async () => fireEvent.click(screen.getByText("go")));
  expect(screen.getByRole("heading", { name: "Confirm It's You" })).toBeTruthy();
  expect(screen.getByText("ana@example.com")).toBeTruthy();
  expect(screen.getByText("Proton Pass")).toBeTruthy();
  // Nothing is sent until asked.
  expect(send).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send Code" })));
  expect(send).toHaveBeenCalledWith("e");
  expect(screen.getByRole("heading", { name: "Check Your Email" })).toBeTruthy();
  await act(async () => paste("000000"));
  expect(screen.getAllByRole("alert").some((alert) => alert.textContent === "That code isn't right.")).toBe(true);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send a New Code" })));
  expect(send).toHaveBeenCalledTimes(2);
  await act(async () => paste("123456"));
  expect(calls).toBe(2);
  expect(screen.getByRole("status").textContent).toContain("Done.");
});

test("with required methods, each one is checked off until all have passed; an authenticator or a recovery code too", async () => {
  const finish = vi.fn(async (ticket: string, step: { kind: string; code: string }) =>
    step.kind === "authenticator" && ticket === "t0"
      ? { status: "done" as const, ticket: "t1", left: ["e"] }
      : { status: "done" as const },
  );
  let calls = 0;
  setUp(async () => (++calls === 1 ? { status: "step-up" } : { status: "done" }), {
    methods: async () => ({
      status: "done",
      ticket: "t0",
      mode: "all",
      methods: [
        { kind: "email", id: "e", hint: "ana@example.com" },
        { kind: "authenticator", id: "a", name: "Proton Pass", createdAt: "2026-11-25T10:00:00Z" },
      ],
      recoveryCode: false,
    }),
    finish,
  });
  await act(async () => fireEvent.click(screen.getByText("go")));
  expect(screen.getByText(/every method you marked required/)).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Enter Code" })));
  expect(screen.getByRole("heading", { name: "Authenticator Code" })).toBeTruthy();
  await act(async () => paste("123456"));
  expect(finish).toHaveBeenLastCalledWith("t0", { kind: "authenticator", id: "a", code: "123456" });
  expect(screen.getByText("Confirmed")).toBeTruthy();
  expect(calls).toBe(1);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send Code" })));
  await act(async () => paste("123456"));
  expect(finish).toHaveBeenLastCalledWith("t1", { kind: "email", requestId: "r", code: "123456" });
  expect(calls).toBe(2);
  cleanup();
  calls = 0;
  setUp(async () => (++calls === 1 ? { status: "step-up" } : { status: "done" }), { finish });
  await act(async () => fireEvent.click(screen.getByText("go")));
  await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Enter Code" })[1]!));
  expect(screen.getByRole("heading", { name: "Recovery Code" })).toBeTruthy();
  await act(async () => fireEvent.change(screen.getByRole("textbox"), { target: { value: "abcd-efgh" } }));
  await act(async () => fireEvent.submit(screen.getByRole("textbox").closest("form")!));
  expect(finish).toHaveBeenLastCalledWith("t0", { kind: "recovery-code", code: "abcd-efgh" });
  expect(calls).toBe(2);
});

test("closing the code goes back to the list; Cancel changes nothing; a code or list that can't come says why", async () => {
  setUp(async () => ({ status: "step-up" }), {}, true);
  await act(async () => fireEvent.click(screen.getByText("go")));
  await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Enter Code" })[0]!));
  await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!));
  expect(screen.getByRole("heading", { name: "Confirm It's You" })).toBeTruthy();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cancel" })));
  expect(document.body.dataset.answer).toBe(JSON.stringify("Not confirmed, so nothing changed."));
  // Its close button gives up too.
  await act(async () => fireEvent.click(screen.getByText("go")));
  await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]!));
  expect(document.body.dataset.answer).toBe(JSON.stringify("Not confirmed, so nothing changed."));
  cleanup();
  setUp(async () => ({ status: "step-up" }), {
    send: async () => ({ status: "refused", reason: "rate-limit", retryAfterSeconds: 60 }),
  });
  await act(async () => fireEvent.click(screen.getByText("go")));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send Code" })));
  expect(screen.getByRole("alert").textContent).toContain("Too many tries.");
  expect(screen.getByRole("heading", { name: "Confirm It's You" })).toBeTruthy();
  cleanup();
  setUp(async () => ({ status: "step-up" }), { methods: async () => ({ status: "step-up" }) });
  await act(async () => fireEvent.click(screen.getByText("go")));
  expect(screen.getByRole("alert").textContent).toContain("Something went wrong.");
  expect(document.body.dataset.answer).toBe("null");
  cleanup();
  setUp(async () => ({ status: "step-up" }), { send: async () => ({ status: "step-up" }) });
  await act(async () => fireEvent.click(screen.getByText("go")));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send Code" })));
  expect(screen.getByRole("alert").textContent).toContain("Something went wrong.");
  cleanup();
  // A new code that can't be sent says why.
  let sends = 0;
  setUp(async () => ({ status: "step-up" }), {
    send: async () =>
      ++sends === 1
        ? { status: "done", requestId: "r" }
        : { status: "refused", reason: "rate-limit", retryAfterSeconds: 9 },
  });
  await act(async () => fireEvent.click(screen.getByText("go")));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send Code" })));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send a New Code" })));
  expect(screen.getAllByRole("alert").some((alert) => alert.textContent!.includes("Too many tries."))).toBe(true);
});

test("forms get the refusal to show, or null when done; outside AccountActions it throws", async () => {
  setUp(async () => ({ status: "refused", reason: "name-invalid" }), {}, true);
  await act(async () => fireEvent.click(screen.getByText("go")));
  expect(document.body.dataset.answer).toBe(JSON.stringify("A name has 1 to 50 characters."));
  cleanup();
  setUp(async () => ({ status: "done" }), {}, true);
  await act(async () => fireEvent.click(screen.getByText("go")));
  expect(document.body.dataset.answer).toBe("null");
  expect(refresh).not.toHaveBeenCalled();
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(() => render(<Runner action={async () => ({ status: "done" })} />)).toThrow("needs AccountActions");
});

test("a step-up that finishes oddly is explained; a change still asking after it is a general error", async () => {
  let calls = 0;
  setUp(async () => (++calls === 1 ? { status: "step-up" } : { status: "done" }), {
    finish: async () => ({ status: "step-up" }),
  });
  await act(async () => fireEvent.click(screen.getByText("go")));
  await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Enter Code" })[0]!));
  await act(async () => paste("123456"));
  expect(
    screen.getAllByRole("alert").some((alert) => alert.textContent === "Something went wrong. Please try again."),
  ).toBe(true);
  cleanup();
  setUp(async () => ({ status: "step-up" }));
  await act(async () => fireEvent.click(screen.getByText("go")));
  await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Enter Code" })[0]!));
  await act(async () => paste("123456"));
  expect(screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("Something went wrong."))).toBe(true);
});
