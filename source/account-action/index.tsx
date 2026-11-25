"use client";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ACCOUNT_WORDS, explainRefusal, say } from "@sharadox/account-web-library/account-words";
import { CodeDialog } from "@sharadox/account-web-library/code-dialog";
import { useToast } from "@sharadox/account-web-library/toast";
import type {
  AccountActionRunner,
  AccountActionsProperties,
  AccountAnswer,
  RunOptions,
} from "@sharadox/account-web-library/account-action/type";

interface Context {
  locale: AccountActionsProperties["locale"];
  /** Asks for a fresh code; resolves true once confirmed, false when given up. */
  confirm: () => Promise<boolean>;
}

const ActionContext = createContext<Context | null>(null);

/**
 * Where account actions run: confirms it's you when a change needs it (a code sent to the account's email, typed in
 * the code pop-up), for every `useAccountAction` below it. Put it inside `ToastProvider`.
 *
 * @example
 * <AccountActions locale="en" stepUp={{ email, start: startStepUp, finish: finishStepUp }}>…</AccountActions>
 */
export function AccountActions({ locale, stepUp, children }: AccountActionsProperties) {
  const [asking, setAsking] = useState(false);
  const request = useRef<string | null>(null);
  const settle = useRef<((confirmed: boolean) => void) | null>(null);
  const { notify } = useToast();

  const send = useCallback(async () => {
    const answer = await stepUp.start();
    if (answer.status !== "done") {
      notify(explainRefusal(answer.status === "refused" ? answer : { reason: "generic" }, locale), "error");
      return false;
    }
    request.current = answer.requestId;
    return true;
  }, [stepUp, notify, locale]);

  const confirm = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        settle.current = resolve;
        void send().then((sent) => (sent ? setAsking(true) : resolve(false)));
      }),
    [send],
  );

  const close = (confirmed: boolean) => {
    setAsking(false);
    settle.current!(confirmed);
  };

  return (
    <ActionContext.Provider value={{ locale, confirm }}>
      {children}
      <CodeDialog
        locale={locale}
        open={asking}
        onClose={() => close(false)}
        title={say(ACCOUNT_WORDS.step.title, locale)}
        text={
          <p>
            {say(ACCOUNT_WORDS.code.sentTo, locale)} <strong>{stepUp.email}</strong>.{" "}
            {say(ACCOUNT_WORDS.code.lasts, locale)}
          </p>
        }
        onSubmit={async (code) => {
          const answer = await stepUp.finish(request.current!, code);
          if (answer.status === "done") {
            close(true);
            return null;
          }
          return explainRefusal(answer.status === "refused" ? answer : { reason: "generic" }, locale);
        }}
        onResend={async () => void (await send())}
      />
    </ActionContext.Provider>
  );
}

/**
 * Runs account actions (see `AccountActionRunner`): a loader meanwhile, a notification with the result, the code
 * pop-up when a fresh code is needed, and the page's data read again once done. Needs `AccountActions` around it.
 *
 * @example
 * const { run, pending } = useAccountAction();
 * await run(() => removeContact(id), { success: "Removed." });
 */
export function useAccountAction(): AccountActionRunner {
  const context = useContext(ActionContext);
  if (!context) throw new Error("useAccountAction needs AccountActions around it");
  const { locale, confirm } = context;
  const { notify } = useToast();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const attempt = async <Done extends object>(
    action: () => Promise<AccountAnswer<Done>>,
    { success, onDone, refresh = true }: RunOptions<Done>,
  ): Promise<{ done: { status: "done" } & Done } | { refusal: string } | { cancelled: string }> => {
    let answer: AccountAnswer<Done>;
    try {
      answer = await action();
      if (answer.status === "step-up") {
        if (!(await confirm())) return { cancelled: say(ACCOUNT_WORDS.common.cancelled, locale) };
        answer = await action();
      }
    } catch {
      return { refusal: say(ACCOUNT_WORDS.error.generic, locale) };
    }
    if (answer.status !== "done")
      return { refusal: explainRefusal(answer.status === "refused" ? answer : { reason: "generic" }, locale) };
    if (success) notify(success);
    onDone?.(answer);
    if (refresh) router.refresh();
    return { done: answer };
  };

  const run: AccountActionRunner["run"] = async (action, options = {}) => {
    setPending(true);
    const result = await attempt(action, options);
    setPending(false);
    if ("cancelled" in result) return null;
    if ("refusal" in result) {
      notify(result.refusal, "error");
      return null;
    }
    return result.done;
  };

  const submit: AccountActionRunner["submit"] = async (action, options = {}) => {
    setPending(true);
    const result = await attempt(action, options);
    setPending(false);
    if ("cancelled" in result) return result.cancelled;
    return "refusal" in result ? result.refusal : null;
  };

  return { pending, run, submit };
}
