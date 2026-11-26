// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { readWho, SignInScreen } from "@sharadox/account-web-library/sign-in-screen";
import type { SignInActions, SignInAnswer } from "@sharadox/account-web-library/sign-in-screen/type";
import { ToastProvider } from "@sharadox/interface-web-library/toast";

const replace = vi.fn();
const refresh = vi.fn();
const prefetch = vi.fn();
const router = { replace, refresh, prefetch };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@sharadox/protection-web-library/proof-of-work-solver", () => ({ solveChallenge: async () => "nonce" }));

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
  replace.mockClear();
  refresh.mockClear();
});

/** The button in the row of the method list that mentions `text`. */
const rowButton = (text: string | RegExp) =>
  within(screen.getAllByRole("listitem").find((row) => row.textContent!.match(text))!).getByRole("button");

const challenge = { salt: "s", difficulty: 1, expiresAt: 0, signature: "x" } as never;
const sent: SignInAnswer = { status: "sent", requestId: "r1" };
const more: SignInAnswer = {
  status: "more",
  ticket: "t2",
  methods: [
    { kind: "authenticator", id: "phone", name: "Phone", createdAt: "2026-01-02T10:00:00.000Z" },
    { kind: "authenticator", id: "tablet", name: null, createdAt: "2026-03-04T10:00:00.000Z" },
    { kind: "email", id: "c2", hint: "w•••@example.com" },
  ],
  recoveryCode: true,
};

const actions = (overrides: Partial<SignInActions> = {}): SignInActions => ({
  challenge: vi.fn(async () => challenge),
  startWithEmail: vi.fn(async () => sent),
  startWithIdentifier: vi.fn(async () => ({ ...more, status: "choose" as const })),
  finishEmail: vi.fn(async ({ code }) =>
    code === "123456" ? { status: "signed-in" as const } : { status: "refused" as const, reason: "wrong" },
  ),
  sendStepCode: vi.fn(async () => ({ status: "sent" as const, requestId: "r2" })),
  finishStep: vi.fn(async () => ({ status: "signed-in" as const })),
  signUp: vi.fn(async () => ({ status: "signed-in" as const })),
  ...overrides,
});

const setUp = (given: SignInActions, locale: "en" | "pt" = "en") =>
  render(
    <ToastProvider label="Notifications" dismissLabel="Dismiss">
      <SignInScreen locale={locale} company="Acme" actions={given} next="/en" rulesHref="/en/rules" />
    </ToastProvider>,
  );

const typeWho = async (value: string) => {
  fireEvent.change(screen.getByLabelText(/Email or Identifier|Email ou Identificador/), { target: { value } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /Continue|Continuar/ })));
};
const paste = async (text: string) =>
  act(
    async () =>
      void fireEvent.paste(screen.getAllByRole("textbox").at(-6)!, { clipboardData: { getData: () => text } }),
  );

test("reads an email or an identifier from the first field", () => {
  expect(readWho(" ana@example.com ")).toEqual({ kind: "email", value: "ana@example.com" });
  expect(readWho("@ana")).toEqual({ kind: "identifier", value: "ana" });
  expect(readWho("ana")).toEqual({ kind: "identifier", value: "ana" });
});

test("an email gets a code in the pop-up; the right code signs in and goes on", async () => {
  const given = actions();
  setUp(given);
  await typeWho("Ana@Example.com");
  expect(given.startWithEmail).toHaveBeenCalledWith({
    email: "ana@example.com",
    solution: { challenge, nonce: "nonce" },
  });
  expect(screen.getByRole("heading", { name: "Check Your Email" })).toBeTruthy();
  expect(screen.getByText("ana@example.com")).toBeTruthy();
  await paste("000000");
  expect(screen.getByRole("alert").textContent).toBe("That code isn't right.");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send a New Code" })));
  expect(given.startWithEmail).toHaveBeenCalledTimes(2);
  await paste("123456");
  expect(replace).toHaveBeenCalledWith("/en");
  expect(refresh).toHaveBeenCalled();
});

test("a badly written email or an unknown identifier is explained on the field", async () => {
  setUp(actions({ startWithIdentifier: vi.fn(async () => ({ status: "refused" as const, reason: "unknown" })) }));
  await typeWho("ana@");
  expect(screen.getByRole("alert").textContent).toBe("That email doesn't look right.");
  await typeWho("nobody");
  expect(screen.getByRole("alert").textContent).toBe("No account has that identifier. Check it, or use your email.");
});

test("an identifier lists the ways in; each method, then the required ones, sign in", async () => {
  const given = actions({
    finishStep: vi.fn(async ({ step }) =>
      step.kind === "authenticator"
        ? more
        : step.kind === "email"
          ? { status: "signed-in" as const }
          : { status: "refused" as const, reason: "wrong" },
    ),
  });
  setUp(given);
  await typeWho("@ana");
  expect(given.startWithIdentifier).toHaveBeenCalledWith({
    identifier: "ana",
    solution: { challenge, nonce: "nonce" },
  });
  expect(screen.getByRole("heading", { name: "How Do You Want to Sign In?" })).toBeTruthy();
  fireEvent.click(rowButton(/Phone/));
  expect(screen.getByRole("heading", { name: "Authenticator Code" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Send a New Code" })).toBeNull();
  await paste("123456");
  expect(given.finishStep).toHaveBeenCalledWith({
    ticket: "t2",
    step: { kind: "authenticator", id: "phone", code: "123456" },
  });
  expect(screen.getByRole("heading", { name: "Confirm Every Required Method" })).toBeTruthy();
  fireEvent.click(rowButton(/^Recovery Code/));
  fireEvent.change(screen.getByRole("textbox", { name: "Recovery Code" }), { target: { value: "AAAA-BBBB" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirm" })));
  expect(screen.getByRole("alert").textContent).toBe("That code isn't right.");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await act(async () => fireEvent.click(rowButton(/w•••@example.com/)));
  expect(given.sendStepCode).toHaveBeenCalledWith({ ticket: "t2", contactId: "c2" });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send a New Code" })));
  expect(given.sendStepCode).toHaveBeenCalledTimes(2);
  await paste("654321");
  expect(given.finishStep).toHaveBeenLastCalledWith({
    ticket: "t2",
    step: { kind: "email", requestId: "r2", code: "654321" },
  });
  expect(replace).toHaveBeenCalledWith("/en");
});

test("an email with no account asks for a name and identifier; nothing before that", async () => {
  const given = actions({
    finishEmail: vi.fn(async () => ({ status: "sign-up" as const, ticket: "t1" })),
    signUp: vi.fn(async ({ identifier }) =>
      identifier === "taken"
        ? { status: "refused" as const, reason: "identifier-taken" }
        : { status: "signed-in" as const },
    ),
  });
  setUp(given);
  await typeWho("new@example.com");
  await paste("123456");
  expect(screen.getByRole("heading", { name: "Create Your Account" })).toBeTruthy();
  const identifier = screen.getByLabelText("Identifier");
  expect(identifier.parentElement!.firstElementChild!.textContent).toBe("@");
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ana" } });
  fireEvent.change(identifier, { target: { value: "taken" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Create Account" })));
  expect(screen.getByRole("alert").textContent).toBe("That identifier is taken. Try another.");
  fireEvent.change(identifier, { target: { value: "@ana" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Create Account" })));
  expect(given.signUp).toHaveBeenLastCalledWith({ ticket: "t1", name: "Ana", identifier: "ana" });
  expect(replace).toHaveBeenCalledWith("/en");
});

test("a browser already signed in to that account goes on; an expired ticket starts again", async () => {
  setUp(actions({ startWithEmail: vi.fn(async () => ({ status: "already" as const })) }));
  await typeWho("ana@example.com");
  expect(screen.getAllByRole("status").some((status) => status.textContent!.includes("already signed in"))).toBe(true);
  expect(replace).toHaveBeenCalledWith("/en");
  cleanup();
  const given = actions({
    finishEmail: vi.fn(async () => ({ status: "sign-up" as const, ticket: "t1" })),
    signUp: vi.fn(async () => ({ status: "refused" as const, reason: "ticket" })),
  });
  setUp(given);
  await typeWho("new@example.com");
  await paste("123456");
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ana" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Create Account" })));
  expect(screen.getByRole("alert").textContent).toContain("That took too long.");
  expect(screen.getByLabelText("Email or Identifier")).toBeTruthy();
});

test("a step's ticket that expired starts again; failed sends are notified", async () => {
  setUp(
    actions({
      sendStepCode: vi.fn(async () => ({ status: "refused" as const, reason: "rate-limit", retryAfterSeconds: 120 })),
      finishStep: vi.fn(async () => ({ status: "refused" as const, reason: "ticket" })),
    }),
  );
  await typeWho("ana");
  await act(async () => fireEvent.click(rowButton(/Code to/)));
  expect(screen.getByRole("alert").textContent).toContain("Wait 2 minutes.");
  expect(rowButton(/Added 4 Mar 2026/)).toBeTruthy();
  fireEvent.click(rowButton(/Phone/));
  await paste("123456");
  expect(screen.getByLabelText("Email or Identifier")).toBeTruthy();
  fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]!);
});

test("going back from the methods or the sign-up; a resend that fails is notified", async () => {
  setUp(
    actions({
      startWithEmail: vi
        .fn()
        .mockResolvedValueOnce(sent)
        .mockResolvedValueOnce({ status: "refused", reason: "unavailable" }),
    }),
    "pt",
  );
  await typeWho("ana@example.com");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Enviar Novo Código" })));
  expect(screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("O envio está em pausa"))).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
  await typeWho("ana");
  fireEvent.click(screen.getByRole("button", { name: "Usar Outro Email ou Identificador" }));
  expect(screen.getByLabelText("Email ou Identificador")).toBeTruthy();
});

test("a proof-of-work refusal or an odd answer is explained", async () => {
  setUp(actions({ startWithEmail: vi.fn(async () => ({ status: "refused" as const, reason: "proof" })) }));
  await typeWho("ana@example.com");
  expect(screen.getByRole("alert").textContent).toBe("Something went wrong. Please try again.");
  cleanup();
  setUp(actions({ finishEmail: vi.fn(async () => ({ status: "sent" as const, requestId: "x" })) }));
  await typeWho("ana@example.com");
  await paste("123456");
  expect(screen.getByRole("heading", { name: "Check Your Email" })).toBeTruthy();
});

test("sign-up from the methods screen and its way back", async () => {
  setUp(actions({ finishEmail: vi.fn(async () => ({ status: "sign-up" as const, ticket: "t" })) }));
  await typeWho("x@example.com");
  await paste("123456");
  fireEvent.click(screen.getByRole("button", { name: "Use Another Email or Identifier" }));
  expect(screen.getByLabelText("Email or Identifier")).toBeTruthy();
});

test("it can sit in the site's own card", () => {
  const { container } = render(
    <ToastProvider label="Notifications" dismissLabel="Dismiss">
      <SignInScreen
        locale="en"
        company="Acme"
        actions={actions()}
        next="/en"
        rulesHref="/en/rules"
        framed={false}
        className="mine"
      />
    </ToastProvider>,
  );
  const card = container.querySelector(".mine")!;
  expect(card).toBeTruthy();
  expect(card.className).not.toContain("framed");
});

test("required methods stay listed together, each checked off once it passes, until the last one signs in", async () => {
  const both: SignInAnswer = { ...more, methods: more.status === "more" ? more.methods.slice(0, 2) : [] };
  const tabletLeft: SignInAnswer = { ...both, ticket: "t3", methods: [{ ...more.methods[1]! }] } as SignInAnswer;
  const given = actions({
    finishEmail: vi.fn(async () => both),
    finishStep: vi.fn(async ({ step }) =>
      step.kind === "authenticator" && step.id === "phone" ? tabletLeft : { status: "signed-in" as const },
    ),
  });
  setUp(given);
  await typeWho("ana@example.com");
  await paste("123456");
  expect(screen.getByRole("heading", { name: "Confirm Every Required Method" })).toBeTruthy();
  fireEvent.click(rowButton(/Phone/));
  await paste("111111");
  const rows = screen.getAllByRole("listitem");
  expect(rows[0]!.textContent).toContain("Confirmed");
  expect(rows).toHaveLength(3);
  fireEvent.click(rowButton(/Added 4 Mar 2026/));
  await paste("222222");
  expect(given.finishStep).toHaveBeenLastCalledWith({
    ticket: "t3",
    step: { kind: "authenticator", id: "tablet", code: "222222" },
  });
  expect(screen.getByText("Signed in. Opening your account…")).toBeTruthy();
  expect(replace).toHaveBeenCalledWith("/en");
});
