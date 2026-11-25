// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { AccountActions, useAccountAction } from "@sharadox/account-web-library/account-action";
import type { AccountAnswer, StepUp } from "@sharadox/account-web-library/account-action/type";
import { ToastProvider } from "@sharadox/account-web-library/toast";

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
        stepUp={{
          email: "ana@example.com",
          start: async () => ({ status: "done", requestId: "r" }),
          finish: async (_request, code) =>
            code === "123456" ? { status: "done" } : { status: "refused", reason: "wrong" },
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

test("a change that needs a fresh code asks for it in the pop-up, then runs again", async () => {
  let calls = 0;
  setUp(async () => (++calls === 1 ? { status: "step-up" } : { status: "done" }));
  await act(async () => fireEvent.click(screen.getByText("go")));
  expect(screen.getByRole("heading", { name: "Confirm It's You" })).toBeTruthy();
  expect(screen.getByText("ana@example.com")).toBeTruthy();
  await act(async () => paste("000000"));
  expect(screen.getAllByRole("alert").some((alert) => alert.textContent === "That code isn't right.")).toBe(true);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send a new code" })));
  await act(async () => paste("123456"));
  expect(calls).toBe(2);
  expect(screen.getByRole("status").textContent).toContain("Done.");
});

test("giving up the code changes nothing; a code that can't be sent says why", async () => {
  setUp(async () => ({ status: "step-up" }), {}, true);
  await act(async () => fireEvent.click(screen.getByText("go")));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Close" })));
  expect(document.body.dataset.answer).toBe(JSON.stringify("Not confirmed, so nothing changed."));
  cleanup();
  setUp(async () => ({ status: "step-up" }), {
    start: async () => ({ status: "refused", reason: "rate-limit", retryAfterSeconds: 60 }),
  });
  await act(async () => fireEvent.click(screen.getByText("go")));
  expect(screen.getByRole("alert").textContent).toContain("Too many tries.");
  expect(document.body.dataset.answer).toBe("null");
  cleanup();
  setUp(async () => ({ status: "step-up" }), {
    start: async () => ({ status: "step-up" }),
    finish: async () => ({ status: "step-up" }),
  });
  await act(async () => fireEvent.click(screen.getByText("go")));
  expect(screen.getByRole("alert").textContent).toContain("Something went wrong.");
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

test("a step-up that finishes oddly is explained", async () => {
  let calls = 0;
  setUp(async () => (++calls === 1 ? { status: "step-up" } : { status: "done" }), {
    finish: async () => ({ status: "step-up" }),
  });
  await act(async () => fireEvent.click(screen.getByText("go")));
  await act(async () => paste("123456"));
  expect(
    screen.getAllByRole("alert").some((alert) => alert.textContent === "Something went wrong. Please try again."),
  ).toBe(true);
});

test("a change still asking for a code after it was given is a general error", async () => {
  setUp(async () => ({ status: "step-up" }));
  await act(async () => fireEvent.click(screen.getByText("go")));
  await act(async () => paste("123456"));
  expect(screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("Something went wrong."))).toBe(true);
});
