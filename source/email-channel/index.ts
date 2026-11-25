import { emailLayout } from "@sharadox/email-web-library/email-layout";
import type {
  CodeDelivery,
  ContactChannel,
  Notice,
  NoticeDelivery,
} from "@sharadox/account-web-library/contact-channel/type";
import type { EmailChannelOptions } from "@sharadox/account-web-library/email-channel/type";

interface Words {
  language: string;
  /** Every code comes in the same email, whatever it is for (signing in, confirming an address or a change). */
  subject: string;
  eyebrow: string;
  heading: string;
  label: string;
  lifetime: (minutes: number) => string;
  ignore: string;
  never: string;
  closing: string;
  notice: Record<Notice["kind"], { subject: string; heading: string; body: (notice: Notice) => string[] }>;
}

const date = (language: string, at: Date) =>
  new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "Europe/Lisbon" }).format(at);
const moment = (language: string, at: Date) =>
  new Intl.DateTimeFormat(language, { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Lisbon" }).format(at);

const ENGLISH: Words = {
  language: "en",
  subject: "Account · Authentication Code",
  eyebrow: "Authentication",
  heading: "Your Authentication Code",
  label: "Code",
  lifetime: (minutes) => `It works once, for ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
  ignore: "If you didn't ask for it, you can ignore this email: without the code, nothing happens.",
  never: "We will never ask you for this code.",
  closing: "Best regards,",
  notice: {
    "inactivity-warning": {
      subject: "Account · Deletion Warning",
      heading: "Your Account Will Be Deleted",
      body: (notice) => [
        `Nobody has signed in to it for a long time, so it will be deleted on ${date("en-GB", (notice as { deletionAt: Date }).deletionAt)}, with everything in it.`,
        "Sign in before then to keep it. If you don't need it any more, there is nothing to do.",
      ],
    },
    "contact-added": {
      subject: "Account · Email Added",
      heading: "An Email Was Added",
      body: (notice) => [
        `${(notice as { contact: string }).contact} can now sign in to your account.`,
        "If it wasn't you, sign in, remove it, and sign out of the devices you don't recognize.",
      ],
    },
    "new-sign-in": {
      subject: "Account · New Sign-In",
      heading: "A New Sign-In",
      body: (notice) => [
        `Someone signed in to your account on a browser that hadn't been used before, on ${moment("en-GB", (notice as { at: Date }).at)} (Portugal's time).`,
        "If it was you, there is nothing to do. If not, sign in, sign out of the devices you don't recognize, and turn on two-step verification.",
      ],
    },
    "recovery-code-used": {
      subject: "Account · Recovery Code Used",
      heading: "A Recovery Code Was Used",
      body: () => [
        "Someone signed in to your account with one of its recovery codes.",
        "If it wasn't you, sign in, make new recovery codes, and sign out of the devices you don't recognize.",
      ],
    },
  },
};

const PORTUGUESE: Words = {
  language: "pt-PT",
  subject: "Conta · Código de Autenticação",
  eyebrow: "Autenticação",
  heading: "O Seu Código de Autenticação",
  label: "Código",
  lifetime: (minutes) => `Funciona uma vez, durante ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`,
  ignore: "Se não o pediu, pode ignorar este email: sem o código, nada acontece.",
  never: "Nunca lhe pediremos este código.",
  closing: "Com os melhores cumprimentos,",
  notice: {
    "inactivity-warning": {
      subject: "Conta · Aviso de Eliminação",
      heading: "A Sua Conta Vai Ser Eliminada",
      body: (notice) => [
        `Ninguém entra nela há muito tempo, por isso será eliminada a ${date("pt-PT", (notice as { deletionAt: Date }).deletionAt)}, com tudo o que contém.`,
        "Entre antes disso para a manter. Se já não precisa dela, não tem de fazer nada.",
      ],
    },
    "contact-added": {
      subject: "Conta · Email Adicionado",
      heading: "Foi Adicionado um Email",
      body: (notice) => [
        `${(notice as { contact: string }).contact} pode agora entrar na sua conta.`,
        "Se não foi você, entre, remova-o e termine a sessão nos dispositivos que não reconhece.",
      ],
    },
    "new-sign-in": {
      subject: "Conta · Novo Início de Sessão",
      heading: "Um Novo Início de Sessão",
      body: (notice) => [
        `Alguém entrou na sua conta num navegador que nunca tinha sido usado, a ${moment("pt-PT", (notice as { at: Date }).at)} (hora de Portugal).`,
        "Se foi você, não tem de fazer nada. Se não, entre, termine a sessão nos dispositivos que não reconhece e ligue a verificação em dois passos.",
      ],
    },
    "recovery-code-used": {
      subject: "Conta · Código de Recuperação Usado",
      heading: "Foi Usado um Código de Recuperação",
      body: () => [
        "Alguém entrou na sua conta com um dos códigos de recuperação.",
        "Se não foi você, entre, crie novos códigos de recuperação e termine a sessão nos dispositivos que não reconhece.",
      ],
    },
  },
};

/**
 * Sends one-time codes by email, in the shared Sharadox email layout (email-web-library), in English or European
 * Portuguese (any `pt` reader). Every code comes in one and the same email, "Account · Authentication Code", whatever
 * it is for; every subject starts with "Account · " ("Conta · ") and the sender's name says whose.
 * The code is in the body only, one box per digit, never the subject (lock screens show subjects), with no link to
 * click: nothing to imitate in a phishing email.
 *
 * @example
 * const channel = createEmailChannel({ sender: createAmazonSesSender(configuration), from, design });
 * await channel.send({ contact, code, purpose: "sign-in", language: "pt-PT", expiresAt });
 */
export function createEmailChannel({
  sender,
  from,
  design,
  logos = [],
  now = Date.now,
}: EmailChannelOptions): ContactChannel {
  const carried = { light: logos.some(({ id }) => id === "logo"), dark: logos.some(({ id }) => id === "logo-dark") };
  return {
    kind: "email",
    async send({ contact, code, language, expiresAt }: CodeDelivery) {
      if (contact.kind !== "email") throw new Error(`the email channel can't send to a "${contact.kind}" contact`);
      const words = language.toLowerCase().startsWith("pt") ? PORTUGUESE : ENGLISH;
      const shown = code.replace(/(.{3})(?=.)/g, "$1 ");
      const minutes = Math.max(1, Math.ceil((expiresAt.getTime() - now()) / 60_000));
      const paragraphs = [words.lifetime(minutes), words.ignore, words.never];
      const html = emailLayout(
        {
          language: words.language,
          preview: words.heading,
          eyebrow: words.eyebrow,
          heading: words.heading,
          code: { label: words.label, value: code },
          paragraphs,
          closing: words.closing,
        },
        design,
        carried,
      );
      const text = [
        words.heading,
        "",
        `${words.label}: ${shown}`,
        "",
        ...paragraphs,
        "",
        words.closing,
        design.name,
      ].join("\n");
      await sender.send({
        from,
        to: contact.value,
        subject: words.subject,
        html,
        text,
        ...(logos.length > 0 ? { inlineImages: logos } : {}),
      });
    },
    async notify({ contact, language, notice }: NoticeDelivery) {
      if (contact.kind !== "email") throw new Error(`the email channel can't send to a "${contact.kind}" contact`);
      const words = language.toLowerCase().startsWith("pt") ? PORTUGUESE : ENGLISH;
      const message = words.notice[notice.kind];
      const paragraphs = message.body(notice);
      const html = emailLayout(
        {
          language: words.language,
          preview: message.heading,
          eyebrow: design.name,
          heading: message.heading,
          rows: [],
          paragraphs,
          closing: words.closing,
        },
        design,
        carried,
      );
      const text = [message.heading, "", ...paragraphs, "", words.closing, design.name].join("\n");
      await sender.send({
        from,
        to: contact.value,
        subject: message.subject,
        html,
        text,
        ...(logos.length > 0 ? { inlineImages: logos } : {}),
      });
    },
  };
}
