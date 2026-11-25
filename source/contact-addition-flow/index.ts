import { setMethodRequired } from "@sharadox/account-web-library/authentication-method";
import { notifyAccount } from "@sharadox/account-web-library/account-notice";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { sendCode } from "@sharadox/account-web-library/code-sending";
import { verifyCode } from "@sharadox/account-web-library/code-verification";
import { contactBanned } from "@sharadox/account-web-library/banned-contact";
import { addContact } from "@sharadox/account-web-library/contact-addition";
import type {
  ContactAdditionFinish,
  ContactAdditionStart,
} from "@sharadox/account-web-library/contact-addition-flow/type";
import { normalizeContact } from "@sharadox/account-web-library/contact-kind";
import type { Contact } from "@sharadox/account-web-library/contact-kind/type";
import { verifyContact } from "@sharadox/account-web-library/contact-verification";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";

/**
 * Adds a contact to an account, unverified, and sends it a code (through `sendCode`); asking again for the same
 * unverified contact sends a new code. Ask for a step-up first, and tell the account's other contacts.
 *
 * @example
 * const result = await startContactAddition(server, { accountId, contact, address, language });
 * if (result.status === "sent") after(result.deliver);
 */
export async function startContactAddition(
  server: AccountServer,
  {
    accountId,
    contact,
    address,
    language,
    now = Date.now(),
  }: { accountId: string; contact: Contact; address: string; language: string; now?: number },
): Promise<ContactAdditionStart> {
  let normalized: Contact;
  try {
    normalized = normalizeContact(contact);
  } catch {
    return { status: "refused", reason: "contact" };
  }
  const channel = server.channels.find(({ kind }) => kind === normalized.kind);
  if (!channel) return { status: "refused", reason: "contact" };
  const pepper = deriveSecret(server.secret, "banned-contact");
  if (await contactBanned(server.database, { contact: normalized, pepper, application: "account", now }))
    return { status: "refused", reason: "contact-banned" };
  const existing = await server.database
    .selectFrom("contact")
    .select(["id", "verified_at"])
    .where("account_id", "=", accountId)
    .where("kind", "=", normalized.kind)
    .where("value", "=", normalized.value)
    .executeTakeFirst();
  if (existing?.verified_at) return { status: "refused", reason: "already-added" };
  let contactId = existing?.id;
  if (!contactId) {
    const added = await addContact(server.database, { accountId, contact: normalized, now });
    if (!added.added) return { status: "refused", reason: added.reason };
    contactId = added.contactId;
  }
  const sent = await sendCode(server, {
    purpose: "contact-verification",
    contact: normalized,
    channel,
    accountId,
    address,
    language,
    now,
  });
  return sent.status === "sent" ? { ...sent, contactId } : sent;
}

/**
 * Verifies the added contact once its code comes back: it can then be used to sign in (and, with `required`, is asked
 * for at every sign-in from then on). Call `notify` after
 * answering, to tell the account's other contacts.
 *
 * @example
 * const result = await finishContactAddition(server, { accountId, requestId, code });
 */
export async function finishContactAddition(
  server: AccountServer,
  {
    accountId,
    requestId,
    code,
    required = false,
    now = Date.now(),
  }: { accountId: string; requestId: string; code: string; required?: boolean; now?: number },
): Promise<ContactAdditionFinish> {
  const verification = await verifyCode(server.database, {
    requestId,
    code,
    purpose: "contact-verification",
    pepper: deriveSecret(server.secret, "one-time-code"),
    now,
  });
  if (!verification.valid) return { status: "refused", reason: verification.reason };
  if (verification.accountId !== accountId) return { status: "refused", reason: "unknown" };
  const contact = await server.database
    .selectFrom("contact")
    .select("id")
    .where("account_id", "=", accountId)
    .where("kind", "=", verification.contact.kind)
    .where("value", "=", verification.contact.value)
    .executeTakeFirst();
  if (!contact) return { status: "refused", reason: "no-contact" };
  const verified = await verifyContact(server.database, { accountId, contactId: contact.id, now });
  if (!verified.verified) return { status: "refused", reason: verified.reason };
  if (required)
    await setMethodRequired(server.database, { accountId, kind: "email", id: contact.id, required: true, now });
  const notify = () =>
    notifyAccount(server, {
      accountId,
      notice: { kind: "contact-added", contact: verification.contact.value },
      except: contact.id,
    });
  return { status: "verified", contactId: contact.id, notify };
}
