import { signIn } from "@sharadox/account-web-library/account-sign-in";
import { contactBanned } from "@sharadox/account-web-library/banned-contact";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import type { Contact } from "@sharadox/account-web-library/contact-kind/type";
import { createPersonAccount } from "@sharadox/account-web-library/person-account";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";
import { readTicket } from "@sharadox/account-web-library/signed-ticket";
import type { SignUpFinish, SignUpFinishResult } from "@sharadox/account-web-library/sign-up-finish/type";

/**
 * The last step for a new person: the name and identifier they chose, with the ticket proving their contact. Creates the
 * account with that contact verified and signs it in. A refused name or identifier can be tried again with the same
 * ticket while it lasts; a ticket can't make two accounts (the contact is then taken). A contact of a deleted account
 * banned from the account system (or everywhere) can't sign up again while that ban lasts.
 *
 * @example
 * const result = await finishSignUp(server, { ticket, name, identifier, token: cookie });
 */
export async function finishSignUp(
  server: AccountServer,
  { ticket, name, identifier, token, userAgent = null, language, now = Date.now() }: SignUpFinish,
): Promise<SignUpFinishResult> {
  const reading = readTicket<{ contact: Contact }>(ticket, {
    secret: deriveSecret(server.secret, "sign-up-ticket"),
    purpose: "sign-up",
    now,
  });
  if (!reading.valid) return { status: "refused", reason: "ticket" };
  const pepper = deriveSecret(server.secret, "banned-contact");
  if (await contactBanned(server.database, { contact: reading.data.contact, pepper, application: "account", now }))
    return { status: "refused", reason: "contact-banned" };
  const created = await createPersonAccount(server.database, {
    name,
    identifier,
    contact: reading.data.contact,
    ...(language ? { language } : {}),
    now,
  });
  if (!created.created) return { status: "refused", reason: created.reason };
  const session = await signIn(server.database, { accountId: created.accountId, token, userAgent, record: false, now });
  return { status: "signed-in", accountId: created.accountId, token: session.token };
}
