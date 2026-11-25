import { expect, test } from "vitest";
import type { EmailMessage } from "@sharadox/email-web-library/email-message/type";
import type { EmailSender } from "@sharadox/email-web-library/email-sender/type";
import { createEmailChannel } from "@sharadox/account-web-library/email-channel";

const sent: EmailMessage[] = [];
const sender: EmailSender = {
  send: async (message) => {
    sent.push(message);
    return { messageId: "id", accepted: [], rejected: [] };
  },
  verify: async () => {},
};
const channel = createEmailChannel({
  sender,
  from: { name: "Luis Pires Decor", address: "account@web.luispiresdecor.com" },
  design: { name: "Luis Pires Decor", signature: [{ text: "luispiresdecor.com", href: "https://luispiresdecor.com" }] },
  now: () => 0,
});

const delivery = (overrides: Partial<Parameters<typeof channel.send>[0]> = {}) => ({
  contact: { kind: "email", value: "ana@example.com" },
  code: "123456",
  purpose: "sign-in" as const,
  language: "en",
  expiresAt: new Date(600_000),
  ...overrides,
});

test("sends the code to the address, in the company's layout and as plain text, without the code in the subject", async () => {
  sent.length = 0;
  await channel.send(delivery());
  const [message] = sent;
  expect(message).toMatchObject({
    from: { name: "Luis Pires Decor", address: "account@web.luispiresdecor.com" },
    to: "ana@example.com",
    subject: "Your Luis Pires Decor sign-in code",
  });
  expect(message!.subject).not.toContain("123");
  expect(message!.html).toContain("123 456");
  expect(message!.html).toContain('lang="en"');
  expect(message!.text).toContain("123 456");
  expect(message!.text).toContain("10 minutes");
  expect(message!.text).toContain("We will never ask you for this code.");
});

test("speaks European Portuguese for any Portuguese reader", async () => {
  sent.length = 0;
  await channel.send(delivery({ language: "pt-BR", purpose: "step-up" }));
  expect(sent[0]!.subject).toBe("O seu código de confirmação de Luis Pires Decor");
  expect(sent[0]!.text).toContain("durante 10 minutos");
  expect(sent[0]!.html).toContain('lang="pt-PT"');
});

test("has its own words for verifying a contact, and falls back to English", async () => {
  sent.length = 0;
  await channel.send(delivery({ language: "de", purpose: "contact-verification", expiresAt: new Date(60_000) }));
  expect(sent[0]!.subject).toBe("Confirm your address for Luis Pires Decor");
  expect(sent[0]!.text).toContain("1 minute.");
});

test("refuses contacts of another kind", async () => {
  await expect(channel.send(delivery({ contact: { kind: "phone", value: "+351" } }))).rejects.toThrow(
    'the email channel can\'t send to a "phone" contact',
  );
  expect(channel.kind).toBe("email");
});

test("uses the clock by default and carries the logos when given", async () => {
  sent.length = 0;
  const logo = { id: "logo", filename: "logo.png", contentType: "image/png", content: new Uint8Array([1]) };
  const withLogo = createEmailChannel({
    sender,
    from: "account@web.example.com",
    design: { name: "Example", logo: { width: 30, height: 30 } },
    logos: [logo],
  });
  await withLogo.send(delivery({ expiresAt: new Date(Date.now() + 600_000) }));
  expect(sent[0]!.inlineImages).toEqual([logo]);
  expect(sent[0]!.html).toContain("cid:logo");
  expect(sent[0]!.text).toContain("10 minutes");
});

test("has a subject and heading for every purpose in both languages", async () => {
  const subjects: string[] = [];
  for (const language of ["en", "pt-PT"]) {
    for (const purpose of ["sign-in", "contact-verification", "step-up"] as const) {
      sent.length = 0;
      await channel.send(delivery({ language, purpose, expiresAt: new Date(60_000) }));
      subjects.push(sent[0]!.subject);
      expect(sent[0]!.text).toMatch(language === "en" ? /1 minute\./ : /1 minuto\./);
    }
  }
  expect(subjects).toEqual([
    "Your Luis Pires Decor sign-in code",
    "Confirm your address for Luis Pires Decor",
    "Your Luis Pires Decor confirmation code",
    "O seu código para entrar em Luis Pires Decor",
    "Confirme o seu endereço em Luis Pires Decor",
    "O seu código de confirmação de Luis Pires Decor",
  ]);
});

test("sends notices in the same layout: inactivity warnings, a new email added, a recovery code used", async () => {
  sent.length = 0;
  await channel.notify!({
    contact: { kind: "email", value: "ana@example.com" },
    language: "en",
    notice: { kind: "inactivity-warning", deletionAt: new Date(Date.UTC(2028, 10, 25)) },
  });
  expect(sent[0]).toMatchObject({ to: "ana@example.com", subject: "Your Luis Pires Decor account will be deleted" });
  expect(sent[0]!.text).toContain("25 November 2028");
  expect(sent[0]!.text).toContain("Sign in before then to keep it");
  await channel.notify!({
    contact: { kind: "email", value: "ana@example.com" },
    language: "pt-PT",
    notice: { kind: "inactivity-warning", deletionAt: new Date(Date.UTC(2028, 0, 2)) },
  });
  expect(sent[1]!.subject).toBe("A sua conta Luis Pires Decor vai ser eliminada");
  expect(sent[1]!.text).toContain("2 de janeiro de 2028");
  await channel.notify!({
    contact: { kind: "email", value: "ana@example.com" },
    language: "en",
    notice: { kind: "contact-added", contact: "new@example.com" },
  });
  expect(sent[2]!.subject).toBe("An email was added to your Luis Pires Decor account");
  expect(sent[2]!.text).toContain("new@example.com");
  await channel.notify!({
    contact: { kind: "email", value: "ana@example.com" },
    language: "pt",
    notice: { kind: "recovery-code-used" },
  });
  expect(sent[3]!.subject).toBe("Foi usado um código de recuperação da sua conta Luis Pires Decor");
  expect(sent[3]!.html).toContain("<html");
  await channel.notify!({
    contact: { kind: "email", value: "ana@example.com" },
    language: "en",
    notice: { kind: "recovery-code-used" },
  });
  expect(sent[4]!.subject).toBe("A recovery code was used for your Luis Pires Decor account");
  await channel.notify!({
    contact: { kind: "email", value: "ana@example.com" },
    language: "pt",
    notice: { kind: "contact-added", contact: "b@example.com" },
  });
  expect(sent[5]!.text).toContain("b@example.com pode agora entrar");
});

test("notices go to email contacts only", async () => {
  await expect(
    channel.notify!({
      contact: { kind: "phone", value: "+351" },
      language: "en",
      notice: { kind: "recovery-code-used" },
    }),
  ).rejects.toThrow(/can't send/);
});

test("notices carry the logos too", async () => {
  sent.length = 0;
  const withLogos = createEmailChannel({
    sender,
    from: { name: "Luis Pires Decor", address: "account@web.luispiresdecor.com" },
    design: { name: "Luis Pires Decor", signature: [] },
    logos: [{ id: "logo", content: new Uint8Array([1]), contentType: "image/png", filename: "logo.png" }],
  });
  await withLogos.notify!({
    contact: { kind: "email", value: "a@example.com" },
    language: "en",
    notice: { kind: "recovery-code-used" },
  });
  expect(sent[0]!.inlineImages).toHaveLength(1);
});
