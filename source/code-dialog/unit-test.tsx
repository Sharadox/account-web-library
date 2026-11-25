// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { CodeDialog } from "@sharadox/account-web-library/code-dialog";

afterEach(cleanup);

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

const paste = (text: string) =>
  fireEvent.paste(screen.getAllByRole("textbox")[0]!, { clipboardData: { getData: () => text } });

test("sends the code once the boxes are full, shows a refusal, and starts the boxes again", async () => {
  const submit = vi.fn(async (code: string) => (code === "111111" ? "That code isn't right." : null));
  const resend = vi.fn(async () => {});
  render(
    <CodeDialog
      locale="en"
      open
      onClose={() => {}}
      title="Check your email"
      text={<p>We sent a code.</p>}
      onSubmit={submit}
      onResend={resend}
    />,
  );
  expect(screen.getByRole("heading", { name: "Check your email" })).toBeTruthy();
  await act(async () => paste("111111"));
  expect(submit).toHaveBeenCalledWith("111111");
  expect(screen.getByRole("alert").textContent).toBe("That code isn't right.");
  expect((screen.getAllByRole("textbox")[0] as HTMLInputElement).value).toBe("");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send a new code" })));
  expect(resend).toHaveBeenCalledOnce();
  expect(screen.getByText("A new code is on its way.")).toBeTruthy();
  await act(async () => paste("123456"));
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a recovery code goes in one field, in Portuguese too", async () => {
  const submit = vi.fn(async () => null);
  render(
    <CodeDialog
      locale="pt"
      open
      onClose={() => {}}
      title="Código"
      text="Escreva um código."
      kind="recovery"
      onSubmit={submit}
    />,
  );
  fireEvent.change(screen.getByLabelText("Código de recuperação"), { target: { value: "ABCD-EFGH" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirmar" })));
  expect(submit).toHaveBeenCalledWith("ABCD-EFGH");
  expect(screen.queryByRole("button", { name: "Enviar novo código" })).toBeNull();
  const form = screen.getByRole("button", { name: "Confirmar" }).closest("form")!;
  (form.querySelector("input[name=code]") as HTMLInputElement).removeAttribute("name");
  await act(async () => fireEvent.submit(form));
  expect(submit).toHaveBeenLastCalledWith("");
});

test("an emailed code counts down to its expiry, then offers a new code or cancelling", async () => {
  vi.useFakeTimers();
  try {
    const resend = vi.fn(async () => {});
    const close = vi.fn();
    render(
      <CodeDialog
        locale="en"
        open
        onClose={close}
        title="Check your email"
        text={<p>We sent a code.</p>}
        lifetimeSeconds={65}
        onSubmit={async () => null}
        onResend={resend}
      />,
    );
    expect(screen.getByText("Expires in 1:05")).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(6_000));
    expect(screen.getByText("Expires in 0:59")).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByText("This code expired.")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send a new code" })));
    expect(resend).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
    expect(screen.getByText("Expires in 1:05")).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(66_000));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(close).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});

test("without a way to send a new one, an expired code can only be cancelled; closed, the count stops", async () => {
  vi.useFakeTimers();
  try {
    const { rerender } = render(
      <CodeDialog
        locale="pt"
        open
        onClose={() => {}}
        title="Veja o seu email"
        text={null}
        lifetimeSeconds={1}
        onSubmit={async () => null}
      />,
    );
    expect(screen.getByText("Expira em 0:01")).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("Este código expirou.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enviar novo código" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
    rerender(
      <CodeDialog
        locale="pt"
        open={false}
        onClose={() => {}}
        title="Veja o seu email"
        text={null}
        lifetimeSeconds={1}
        onSubmit={async () => null}
      />,
    );
    expect(screen.queryByText("Este código expirou.")).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
