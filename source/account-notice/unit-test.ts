import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import { notifyAccount } from "@sharadox/account-web-library/account-notice";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import type { NoticeDelivery } from "@sharadox/account-web-library/contact-channel/type";
import { addContact } from "@sharadox/account-web-library/contact-addition";
import { verifyContact } from "@sharadox/account-web-library/contact-verification";
import { createTestPerson } from "@sharadox/account-web-library/test-person";
import { createTestServerDatabase } from "@sharadox/account-web-library/test-server";

let memory: MemoryDatabase<AccountServerDatabase>;
let server: AccountServer;
let notices: NoticeDelivery[];
beforeEach(async () => {
  memory = await createTestServerDatabase();
  notices = [];
  server = {
    database: memory.database,
    secret: "a-root-secret-of-at-least-thirty-two-characters",
    channels: [{ kind: "email", send: async () => {}, notify: async (delivery) => void notices.push(delivery) }],
  };
});
afterEach(() => memory.close());

test("tells every verified contact of the account, but the one left out, in the account's language", async () => {
  const { accountId, contactId } = await createTestPerson(memory.database, "ana");
  const added = await addContact(memory.database, { accountId, contact: { kind: "email", value: "work@example.com" } });
  if (!added.added) throw new Error(added.reason);
  await verifyContact(memory.database, { accountId, contactId: added.contactId });
  await addContact(memory.database, { accountId, contact: { kind: "email", value: "unverified@example.com" } });
  await memory.database.updateTable("account").set({ language: "pt-PT" }).where("id", "=", accountId).execute();
  await notifyAccount(server, { accountId, notice: { kind: "recovery-code-used" } });
  expect(notices.map(({ contact, language }) => [contact.value, language])).toEqual([
    ["ana@example.com", "pt-PT"],
    ["work@example.com", "pt-PT"],
  ]);
  notices.length = 0;
  await notifyAccount(server, {
    accountId,
    notice: { kind: "contact-added", contact: "work@example.com" },
    except: added.contactId,
  });
  expect(notices.map(({ contact }) => contact.value)).toEqual(["ana@example.com"]);
  expect(contactId).toBeTruthy();
});

test("a failed notice doesn't stop the others, and is recorded", async () => {
  const { accountId } = await createTestPerson(memory.database, "bia");
  server.channels = [
    {
      kind: "email",
      send: async () => {},
      notify: async () => {
        throw new Error("down");
      },
    },
  ];
  await notifyAccount(server, { accountId, notice: { kind: "recovery-code-used" } });
  const failed = await memory.database
    .selectFrom("audit_event")
    .select("detail")
    .where("action", "=", "notice.delivery-failed")
    .execute();
  expect(failed).toEqual([{ detail: { kind: "recovery-code-used", error: "Error: down" } }]);
});
