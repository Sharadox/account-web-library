"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "@sharadox/icon-web-library/icon";
import { classNames } from "@sharadox/web-library/class-name";
import { solveChallenge } from "@sharadox/protection-web-library/proof-of-work-solver";
import type { Solution } from "@sharadox/protection-web-library/proof-of-work/type";
import { Button } from "@sharadox/interface-web-library/button";
import { ACCOUNT_WORDS, explainRefusal, say } from "@sharadox/account-web-library/account-words";
import type { MethodChoice } from "@sharadox/account-web-library/authentication-method/type";
import { authenticatorLabel } from "@sharadox/account-web-library/authenticator-label";
import { CodeDialog } from "@sharadox/account-web-library/code-dialog";
import { CODE_LIFETIME_SECONDS } from "@sharadox/account-web-library/code-lifetime";
import { normalizeEmail } from "@sharadox/account-web-library/email-contact";
import { TextField } from "@sharadox/interface-web-library/text-field";
import { useToast } from "@sharadox/interface-web-library/toast";
import styles from "./index.module.scss";
import type { SignInAnswer, SignInScreenProperties } from "@sharadox/account-web-library/sign-in-screen/type";

/** What the code pop-up is asking for. */
type Asking =
  | { kind: "email"; requestId: string; to: string; ticket?: string; contactId?: string }
  | { kind: "authenticator"; id: string; name: string }
  | { kind: "recovery-code" };

/**
 * Typed into the first field: an email (it has an @ after its first character), or an identifier (with or without its
 * leading @).
 *
 * @example
 * readWho("@ana"); // { kind: "identifier", value: "ana" }
 */
export function readWho(typed: string): { kind: "email" | "identifier"; value: string } {
  const value = typed.trim();
  return value.indexOf("@") > 0 ? { kind: "email", value } : { kind: "identifier", value: value.replace(/^@/, "") };
}

/**
 * Signing in and signing up in one place, with no password:
 * 1. an email or an identifier (a proof of work is solved meanwhile, invisibly);
 * 2. an email gets a code, typed in a pop-up of 6 boxes; an identifier lists the account's ways in;
 * 3. every method the account marks required is asked for next, one after another;
 * 4. an email with no account asks for a name and an identifier: nothing is saved until then.
 * Every step shows a loader while it's checked. It sits in its own card, or (`framed={false}`) in the site's.
 *
 * @example
 * <SignInScreen locale="en" company="Luis Pires Decor" actions={actions} next="/en" rulesHref="/en/rules" />
 */
export function SignInScreen({
  locale,
  company,
  actions,
  next,
  rulesHref,
  framed = true,
  className,
}: SignInScreenProperties) {
  const router = useRouter();
  const { notify } = useToast();
  const [stage, setStage] = useState<"who" | "methods" | "sign-up">("who");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [ticket, setTicket] = useState("");
  const [methods, setMethods] = useState<{ list: MethodChoice[]; recoveryCode: boolean; more: boolean }>({
    list: [],
    recoveryCode: false,
    more: false,
  });
  const [email, setEmail] = useState("");
  const solution = useRef<Promise<Solution>>(null);
  const words = ACCOUNT_WORDS.signIn;
  const code = ACCOUNT_WORDS.code;

  // Each solution counts once: one is always being prepared for the next request.
  const prepare = useCallback(() => {
    solution.current = actions
      .challenge()
      .then(async (challenge) => ({ challenge, nonce: await solveChallenge(challenge) }));
  }, [actions]);
  useEffect(prepare, [prepare]);

  // Anything but a refusal reaching here is unexpected: it reads as a general error.
  const explain = (answer: SignInAnswer) => explainRefusal(answer as { reason: string }, locale);

  /** Follows an answer to wherever it leads; an error to show, or null. */
  const follow = (answer: SignInAnswer): string | null => {
    switch (answer.status) {
      case "signed-in":
      case "already":
        setAsking(null);
        notify(
          say(answer.status === "already" ? words.already : words.signedIn, locale),
          answer.status === "already" ? "info" : "success",
        );
        router.replace(next);
        router.refresh();
        return null;
      case "sign-up":
        setAsking(null);
        setTicket(answer.ticket);
        setStage("sign-up");
        return null;
      case "choose":
      case "more":
        setAsking(null);
        setTicket(answer.ticket);
        setMethods({ list: answer.methods, recoveryCode: answer.recoveryCode, more: answer.status === "more" });
        setStage("methods");
        return null;
      case "sent":
        return null;
      default:
        return explain(answer);
    }
  };

  const submitWho = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const who = readWho(String(new FormData(event.currentTarget).get("who")));
    if (who.kind === "email") {
      try {
        who.value = normalizeEmail(who.value);
      } catch {
        return setError(say(ACCOUNT_WORDS.error.email, locale));
      }
    }
    setPending(true);
    const proof = await solution.current!;
    prepare();
    const answer =
      who.kind === "email"
        ? await actions.startWithEmail({ email: who.value, solution: proof })
        : await actions.startWithIdentifier({ identifier: who.value, solution: proof });
    setPending(false);
    switch (answer.status) {
      case "sent":
        setEmail(who.value);
        setAsking({ kind: "email", requestId: answer.requestId, to: who.value });
        break;
      case "refused":
        setError(answer.reason === "unknown" ? say(words.unknown, locale) : follow(answer));
        break;
      default:
        setError(follow(answer));
    }
  };

  const chooseEmail = async (contactId: string, hint: string) => {
    setPending(true);
    const answer = await actions.sendStepCode({ ticket, contactId });
    setPending(false);
    if (answer.status === "sent")
      return setAsking({ kind: "email", requestId: answer.requestId, to: hint, ticket, contactId });
    notify(explain(answer), "error");
  };

  const check = async (typed: string): Promise<string | null> => {
    const current = asking!;
    let answer: SignInAnswer;
    if (current.kind === "email" && !current.ticket)
      answer = await actions.finishEmail({ requestId: current.requestId, code: typed });
    else if (current.kind === "email")
      answer = await actions.finishStep({ ticket, step: { kind: "email", requestId: current.requestId, code: typed } });
    else if (current.kind === "authenticator")
      answer = await actions.finishStep({ ticket, step: { kind: "authenticator", id: current.id, code: typed } });
    else answer = await actions.finishStep({ ticket, step: { kind: "recovery-code", code: typed } });
    if (answer.status === "refused" && answer.reason === "ticket") {
      setAsking(null);
      setStage("who");
      notify(say(ACCOUNT_WORDS.error.ticket, locale), "error");
      return null;
    }
    return follow(answer);
  };

  const resend = async () => {
    const current = asking as Extract<Asking, { kind: "email" }>;
    let answer: SignInAnswer;
    if (current.contactId) answer = await actions.sendStepCode({ ticket, contactId: current.contactId });
    else {
      const proof = await solution.current!;
      prepare();
      answer = await actions.startWithEmail({ email, solution: proof });
    }
    if (answer.status === "sent") setAsking({ ...current, requestId: answer.requestId });
    else notify(explain(answer), "error");
  };

  const submitSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const answer = await actions.signUp({
      ticket,
      name: String(form.get("name")),
      identifier: String(form.get("identifier")).replace(/^@/, ""),
    });
    setPending(false);
    if (answer.status === "refused" && answer.reason === "ticket") {
      setStage("who");
      return notify(say(ACCOUNT_WORDS.error.ticket, locale), "error");
    }
    setError(follow(answer));
  };

  const restart = () => {
    setStage("who");
    setError(null);
  };

  return (
    <div className={classNames(styles.screen, framed && styles.framed, className)}>
      {stage === "who" && (
        <form className={styles.step} onSubmit={submitWho} noValidate>
          <h1 className={styles.title}>{say(words.title, locale)}</h1>
          <p className={styles.lead}>{say(words.text, locale)}</p>
          <TextField
            label={say(words.who, locale)}
            name="who"
            autoComplete="username"
            inputMode="email"
            spellCheck={false}
            autoCapitalize="none"
            required
            maxLength={320}
            tip={{ label: say(ACCOUNT_WORDS.common.tip, locale), text: say(words.whoTip, locale) }}
            error={error}
            autoFocus
          />
          <Button type="submit" pending={pending} pendingLabel={say(words.sending, locale)}>
            {say(words.continue, locale)}
          </Button>
        </form>
      )}
      {stage === "methods" && (
        <div className={styles.step}>
          <h1 className={styles.title}>{say(methods.more ? words.next : words.choose, locale)}</h1>
          {methods.more && <p className={styles.lead}>{say(words.nextText, locale)}</p>}
          <ul className={styles.methods}>
            {methods.list.map((method) => (
              <li key={method.id}>
                <button
                  type="button"
                  className={styles.method}
                  disabled={pending}
                  onClick={() =>
                    method.kind === "email"
                      ? void chooseEmail(method.id, method.hint)
                      : setAsking({ kind: "authenticator", id: method.id, name: authenticatorLabel(method, locale) })
                  }
                >
                  <Icon name={method.kind === "email" ? "email" : "key"} />
                  <span>
                    {method.kind === "email" ? (
                      <>
                        {say(words.byEmail, locale)} <strong>{method.hint}</strong>
                      </>
                    ) : (
                      <>
                        {say(words.byAuthenticator, locale)}: <strong>{authenticatorLabel(method, locale)}</strong>
                      </>
                    )}
                  </span>
                  <Icon name="chevron-right" />
                </button>
              </li>
            ))}
            {methods.recoveryCode && (
              <li>
                <button type="button" className={styles.method} onClick={() => setAsking({ kind: "recovery-code" })}>
                  <Icon name="lock" />
                  <span>{say(words.byRecovery, locale)}</span>
                  <Icon name="chevron-right" />
                </button>
              </li>
            )}
          </ul>
          <Button look="plain" onClick={restart}>
            {say(words.useAnother, locale)}
          </Button>
        </div>
      )}
      {stage === "sign-up" && (
        <form className={styles.step} onSubmit={submitSignUp} noValidate>
          <h1 className={styles.title}>{say(ACCOUNT_WORDS.signUp.title, locale)}</h1>
          <p className={styles.lead}>{say(ACCOUNT_WORDS.signUp.text, locale)}</p>
          <TextField
            label={say(ACCOUNT_WORDS.signUp.name, locale)}
            name="name"
            autoComplete="name"
            required
            maxLength={50}
            tip={{ label: say(ACCOUNT_WORDS.common.tip, locale), text: say(ACCOUNT_WORDS.signUp.nameTip, locale) }}
            autoFocus
          />
          <TextField
            label={say(ACCOUNT_WORDS.signUp.identifier, locale)}
            name="identifier"
            prefix="@"
            autoComplete="username"
            spellCheck={false}
            autoCapitalize="none"
            required
            maxLength={50}
            tip={{
              label: say(ACCOUNT_WORDS.common.tip, locale),
              text: say(ACCOUNT_WORDS.signUp.identifierTip, locale),
            }}
          />
          <p className={styles.small}>
            <Link href={rulesHref}>{say(ACCOUNT_WORDS.signUp.age, locale)}</Link>
          </p>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <Button type="submit" pending={pending} pendingLabel={say(ACCOUNT_WORDS.signUp.creating, locale)}>
            {say(ACCOUNT_WORDS.signUp.submit, locale)}
          </Button>
          <Button look="plain" onClick={restart}>
            {say(words.useAnother, locale)}
          </Button>
        </form>
      )}
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
        {...(asking?.kind === "email" ? { onResend: resend, lifetimeSeconds: CODE_LIFETIME_SECONDS } : {})}
      />
    </div>
  );
}
