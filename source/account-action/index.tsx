"use client";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ACCOUNT_WORDS, explainRefusal, say } from "@sharadox/account-web-library/account-words";
import { CodeDialog } from "@sharadox/account-web-library/code-dialog";
import { CODE_LIFETIME_SECONDS } from "@sharadox/account-web-library/code-lifetime";
import { Button } from "@sharadox/interface-web-library/button";
import { Dialog } from "@sharadox/interface-web-library/dialog";
import { useToast } from "@sharadox/interface-web-library/toast";
import type { MethodChoice } from "@sharadox/account-web-library/authentication-method/type";
import { authenticatorLabel } from "@sharadox/account-web-library/authenticator-label";
import { MethodList } from "@sharadox/account-web-library/method-list";
import type { PickedMethod } from "@sharadox/account-web-library/method-list/type";
import styles from "./index.module.scss";
import type {
  AccountActionRunner,
  AccountActionsProperties,
  AccountAnswer,
  RunOptions,
  StepUpStepInput,
} from "@sharadox/account-web-library/account-action/type";

interface Context {
  locale: AccountActionsProperties["locale"];
  /** Asks to confirm it's you; resolves true once confirmed, false when given up. */
  confirm: () => Promise<boolean>;
}

const ActionContext = createContext<Context | null>(null);

/** The ways to confirm, once loaded: the ticket for the next step and the methods passed. */
interface Choosing {
  ticket: string;
  mode: "all" | "one";
  methods: MethodChoice[];
  recoveryCode: boolean;
  done: string[];
}

/** What the code pop-up is asking for. */
type Asking =
  | { kind: "email"; id: string; to: string; requestId: string }
  | { kind: "authenticator"; id: string; name: string }
  | { kind: "recovery-code" };

/**
 * Where account actions run: when a change needs confirming it's you, a pop-up lists the account's ways in, all
 * equally valid (every required one, when it has some; otherwise any one, picked by the person). Each email sends
 * its code only when asked; each code goes in the code pop-up. Put it inside `ToastProvider`.
 *
 * @example
 * <AccountActions locale="en" company="Luis Pires Decor" stepUp={{ methods, send, finish }}>…</AccountActions>
 */
export function AccountActions({ locale, company, stepUp, children }: AccountActionsProperties) {
  const [choosing, setChoosing] = useState<Choosing | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const settle = useRef<((confirmed: boolean) => void) | null>(null);
  const { notify } = useToast();
  const refusal = (answer: AccountAnswer<object>) =>
    explainRefusal(answer.status === "refused" ? answer : { reason: "generic" }, locale);

  const confirm = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        settle.current = resolve;
        void stepUp.methods().then((answer) => {
          if (answer.status !== "done") {
            notify(refusal(answer), "error");
            return resolve(false);
          }
          setChoosing({ ...answer, done: [] });
        });
      }),
    [stepUp, notify, locale],
  );

  const finish = (confirmed: boolean) => {
    setAsking(null);
    setChoosing(null);
    settle.current!(confirmed);
  };

  const send = async (id: string, to: string) => {
    setPending(id);
    const answer = await stepUp.send(id);
    setPending(null);
    if (answer.status !== "done") return notify(refusal(answer), "error");
    setAsking({ kind: "email", id, to, requestId: answer.requestId });
  };

  const pick = (method: PickedMethod) => {
    if (method.kind === "email") void send(method.id, method.hint);
    else if (method.kind === "authenticator")
      setAsking({ kind: "authenticator", id: method.id, name: authenticatorLabel(method, locale) });
    else setAsking({ kind: "recovery-code" });
  };

  const check = async (code: string): Promise<string | null> => {
    const current = asking!;
    const step: StepUpStepInput =
      current.kind === "email"
        ? { kind: "email", requestId: current.requestId, code }
        : current.kind === "authenticator"
          ? { kind: "authenticator", id: current.id, code }
          : { kind: "recovery-code", code };
    const answer = await stepUp.finish(choosing!.ticket, step);
    if (answer.status !== "done") return refusal(answer);
    if (!answer.left?.length) {
      finish(true);
      return null;
    }
    const passed = (current as { id: string }).id;
    setChoosing({ ...choosing!, ticket: answer.ticket!, done: [...choosing!.done, passed] });
    setAsking(null);
    return null;
  };

  const code = ACCOUNT_WORDS.code;
  return (
    <ActionContext.Provider value={{ locale, confirm }}>
      {children}
      <Dialog
        open={choosing !== null}
        onClose={() => finish(false)}
        title={say(ACCOUNT_WORDS.step.title, locale)}
        closeLabel={say(ACCOUNT_WORDS.common.close, locale)}
      >
        {choosing && (
          <>
            <p className={styles.text}>
              {say(choosing.mode === "all" ? ACCOUNT_WORDS.step.textAll : ACCOUNT_WORDS.step.textOne, locale)}
            </p>
            <MethodList
              locale={locale}
              methods={choosing.methods}
              done={choosing.done}
              recoveryCode={choosing.recoveryCode}
              pending={pending}
              onPick={pick}
            />
            <div className={styles.actions}>
              <Button look="quiet" onClick={() => finish(false)}>
                {say(ACCOUNT_WORDS.common.cancel, locale)}
              </Button>
            </div>
          </>
        )}
      </Dialog>
      <CodeDialog
        locale={locale}
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={say(
          asking?.kind === "authenticator"
            ? code.authenticatorTitle
            : asking?.kind === "recovery-code"
              ? code.recoveryTitle
              : code.title,
          locale,
        )}
        kind={asking?.kind === "recovery-code" ? "recovery" : "digits"}
        text={
          asking?.kind === "authenticator" ? (
            <p>
              {say(code.authenticatorText, locale)} <strong>{company}</strong> ({asking.name}).
            </p>
          ) : asking?.kind === "recovery-code" ? (
            <p>{say(code.recoveryText, locale)}</p>
          ) : (
            <p>
              {say(code.sentTo, locale)} <strong>{asking?.kind === "email" ? asking.to : ""}</strong>.{" "}
              {say(code.lasts, locale)}
            </p>
          )
        }
        onSubmit={check}
        {...(asking?.kind === "email"
          ? {
              lifetimeSeconds: CODE_LIFETIME_SECONDS,
              onResend: async () => {
                const answer = await stepUp.send(asking.id);
                if (answer.status === "done") setAsking({ ...asking, requestId: answer.requestId });
                else notify(refusal(answer), "error");
              },
            }
          : {})}
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
