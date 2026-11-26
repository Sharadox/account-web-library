import { render, type RenderResult } from "@testing-library/react";
import { act, type ReactNode } from "react";
import { AccountActions } from "@sharadox/account-web-library/account-action";
import type { StepUp } from "@sharadox/account-web-library/account-action/type";
import { ToastProvider } from "@sharadox/interface-web-library/toast";

/**
 * For tests of the account screens: renders `screen` inside the notifications and the action runner, with a step-up
 * by one email (ana@example.com) whose right code is 123456 (`confirmItsMe` goes through it). Mock
 * `next/navigation`'s `useRouter` in the test.
 *
 * @example
 * renderAccountScreen(<IdentityPanel … />);
 */
export function renderAccountScreen(screen: ReactNode, stepUp: Partial<StepUp> = {}): RenderResult {
  return render(
    <ToastProvider label="Notifications" dismissLabel="Dismiss">
      <AccountActions
        locale="en"
        company="Acme"
        stepUp={{
          methods: async () => ({
            status: "done",
            ticket: "ticket",
            mode: "one",
            methods: [{ kind: "email", id: "contact", hint: "ana@example.com" }],
            recoveryCode: false,
          }),
          send: async () => ({ status: "done", requestId: "step" }),
          finish: async (_ticket, step) =>
            step.code === "123456" ? { status: "done" } : { status: "refused", reason: "wrong" },
          ...stepUp,
        }}
      >
        {screen}
      </AccountActions>
    </ToastProvider>,
  );
}

/** For tests: makes happy-dom's dialogs open and close as a browser's do. */
export function openDialogs(): void {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}

/**
 * For tests: in the "Confirm It's You" pop-up of `renderAccountScreen`, sends the email's code and types `code`
 * (it runs React's updates itself: don't wrap it in `act`).
 *
 * @example
 * await confirmItsMe();
 */
export async function confirmItsMe(code = "123456"): Promise<void> {
  const send = Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "Send Code");
  await act(async () => send!.click());
  const box = document.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!;
  const paste = new Event("paste", { bubbles: true }) as Event & { clipboardData: unknown };
  paste.clipboardData = { getData: () => code };
  await act(async () => void box.dispatchEvent(paste));
}

/**
 * For tests: finishes every dialog's leaving animation at once (happy-dom runs none), so closed dialogs are gone.
 *
 * @example
 * fireEvent.click(close); endDialogAnimations();
 */
export function endDialogAnimations(): void {
  for (const dialog of document.querySelectorAll("dialog[data-closing]"))
    dialog.dispatchEvent(new Event("animationend", { bubbles: true }));
}
