import { render, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { AccountActions } from "@sharadox/account-web-library/account-action";
import type { StepUp } from "@sharadox/account-web-library/account-action/type";
import { ToastProvider } from "@sharadox/interface-web-library/toast";

/**
 * For tests of the account screens: renders `screen` inside the notifications and the action runner, with a step-up
 * whose right code is 123456. Mock `next/navigation`'s `useRouter` in the test.
 *
 * @example
 * renderAccountScreen(<IdentityPanel … />);
 */
export function renderAccountScreen(screen: ReactNode, stepUp: Partial<StepUp> = {}): RenderResult {
  return render(
    <ToastProvider label="Notifications" dismissLabel="Dismiss">
      <AccountActions
        locale="en"
        stepUp={{
          email: "ana@example.com",
          start: async () => ({ status: "done", requestId: "step" }),
          finish: async (_request, code) =>
            code === "123456" ? { status: "done" } : { status: "refused", reason: "wrong" },
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
