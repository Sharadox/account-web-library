import { emailLayout } from "@sharadox/email-web-library/email-layout";
import type { CodePurpose } from "@sharadox/account-web-library/code-request/type";
import type {
  CodeDelivery,
  ContactChannel,
  Notice,
  NoticeDelivery,
} from "@sharadox/account-web-library/contact-channel/type";
import type { EmailChannelOptions } from "@sharadox/account-web-library/email-channel/type";

interface Words {
  language: string;
  subject: Record<CodePurpose, (company: string) => string>;
  eyebrow: Record<CodePurpose, string>;
  heading: Record<CodePurpose, string>;
  label: string;
  lifetime: (minutes: number) => string;
  ignore: string;
  never: string;
  closing: string;
  notice: Record<
    Notice["kind"],
    { subject: (company: string) => string; heading: string; body: (notice: Notice) => string[] }
  >;
}

const date = (language: string, at: Date) =>
  new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "Europe/Lisbon" }).format(at);

const ENGLISH: Words = {
  language: "en",
  subject: {
    "sign-in": (company) => `Your ${company} sign-in code`,
    "contact-verification": (company) => `Confirm your address for ${company}`,
    "step-up": (company) => `Your ${company} confirmation code`,
  },
  eyebrow: { "sign-in": "Sign in", "contact-verification": "Confirm address", "step-up": "Confirmation" },
  heading: {
    "sign-in": "Your sign-in code",
    "contact-verification": "Confirm this address",
    "step-up": "Confirm it's you",
  },
  label: "Code",
  lifetime: (minutes) => `It works once, for ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
  ignore: "If you didn't ask for it, you can ignore this email: without the code, nobody gets in.",
  never: "We will never ask you for this code.",
  closing: "Best regards,",
  notice: {
    "inactivity-warning": {
      subject: (company) => `Your ${company} account will be deleted`,
      heading: "Your account will be deleted",
      body: (notice) => [
        `Nobody has signed in to it for a long time, so it will be deleted on ${date("en-GB", (notice as { deletionAt: Date }).deletionAt)}, with everything in it.`,
        "Sign in before then to keep it. If you don't need it any more, there is nothing to do.",
      ],
    },
    "contact-added": {
      subject: (company) => `An email was added to your ${company} account`,
      heading: "An email was added",
      body: (notice) => [
        `${(notice as { contact: string }).contact} can now sign in to your account.`,
        "If it wasn't you, sign in, remove it, and sign out of the devices you don't recognize.",
      ],
    },
    "recovery-code-used": {
      subject: (company) => `A recovery code was used for your ${company} account`,
      heading: "A recovery code was used",
      body: () => [
        "Someone signed in to your account with one of its recovery codes.",
        "If it wasn't you, sign in, make new recovery codes, and sign out of the devices you don't recognize.",
      ],
    },
  },
};

const PORTUGUESE: Words = {
  language: "pt-PT",
  subject: {
    "sign-in": (company) => `O seu código para entrar em ${company}`,
    "contact-verification": (company) => `Confirme o seu endereço em ${company}`,
    "step-up": (company) => `O seu código de confirmação de ${company}`,
  },
  eyebrow: { "sign-in": "Entrar", "contact-verification": "Confirmar endereço", "step-up": "Confirmação" },
  heading: {
    "sign-in": "O seu código para entrar",
    "contact-verification": "Confirme este endereço",
    "step-up": "Confirme que é você",
  },
  label: "Código",
  lifetime: (minutes) => `Funciona uma vez, durante ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`,
  ignore: "Se não o pediu, pode ignorar este email: sem o código, ninguém entra.",
  never: "Nunca lhe pediremos este código.",
  closing: "Com os melhores cumprimentos,",
  notice: {
    "inactivity-warning": {
      subject: (company) => `A sua conta ${company} vai ser eliminada`,
      heading: "A sua conta vai ser eliminada",
      body: (notice) => [
        `Ninguém entra nela há muito tempo, por isso será eliminada a ${date("pt-PT", (notice as { deletionAt: Date }).deletionAt)}, com tudo o que contém.`,
        "Entre antes disso para a manter. Se já não precisa dela, não tem de fazer nada.",
      ],
    },
    "contact-added": {
      subject: (company) => `Foi adicionado um email à sua conta ${company}`,
      heading: "Foi adicionado um email",
      body: (notice) => [
        `${(notice as { contact: string }).contact} pode agora entrar na sua conta.`,
        "Se não foi você, entre, remova-o e termine a sessão nos dispositivos que não reconhece.",
      ],
    },
    "recovery-code-used": {
      subject: (company) => `Foi usado um código de recuperação da sua conta ${company}`,
      heading: "Foi usado um código de recuperação",
      body: () => [
        "Alguém entrou na sua conta com um dos códigos de recuperação.",
        "Se não foi você, entre, crie novos códigos de recuperação e termine a sessão nos dispositivos que não reconhece.",
      ],
    },
  },
};

/**
 * Sends one-time codes by email, in the shared Sharadox email layout (email-web-library), in English or European
 * Portuguese (any `pt` reader). The code is in the body only, never the subject (lock screens show subjects), with
 * no link to click: nothing to imitate in a phishing email.
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
    async send({ contact, code, purpose, language, expiresAt }: CodeDelivery) {
      if (contact.kind !== "email") throw new Error(`the email channel can't send to a "${contact.kind}" contact`);
      const words = language.toLowerCase().startsWith("pt") ? PORTUGUESE : ENGLISH;
      const shown = code.replace(/(.{3})(?=.)/g, "$1 ");
      const minutes = Math.max(1, Math.ceil((expiresAt.getTime() - now()) / 60_000));
      const paragraphs = [words.lifetime(minutes), words.ignore, words.never];
      const html = emailLayout(
        {
          language: words.language,
          preview: words.heading[purpose],
          eyebrow: words.eyebrow[purpose],
          heading: words.heading[purpose],
          rows: [{ label: words.label, value: shown }],
          paragraphs,
          closing: words.closing,
        },
        design,
        carried,
      );
      const text = [
        words.heading[purpose],
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
        subject: words.subject[purpose](design.name),
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
        subject: message.subject(design.name),
        html,
        text,
        ...(logos.length > 0 ? { inlineImages: logos } : {}),
      });
    },
  };
}
