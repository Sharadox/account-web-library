import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import { deleteAccount } from "@sharadox/account-web-library/account-deletion";
import type { InactivityWarningTable } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import type { PictureStorage } from "@sharadox/account-web-library/picture-storage/type";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";

/** How long an account may go unused before it is deleted. */
const YEARS = 2;

/** The warnings before deletion, earliest first: how far before it, in months or days. */
const STAGES: { stage: InactivityWarningTable["stage"]; months?: number; days?: number }[] = [
  { stage: "6-months", months: 6 },
  { stage: "3-months", months: 3 },
  { stage: "1-month", months: 1 },
  { stage: "1-week", days: 7 },
  { stage: "1-day", days: 1 },
];

/**
 * When an account last active at `activeAt` is deleted: the same moment two years on (29 February leading to
 * 1 March).
 *
 * @example
 * deletionDate(account.last_active_at); // two years later
 */
export function deletionDate(activeAt: Date): Date {
  const at = new Date(activeAt);
  at.setUTCFullYear(at.getUTCFullYear() + YEARS);
  return at;
}

const before = (deletion: Date, { months = 0, days = 0 }: { months?: number; days?: number }) => {
  const at = new Date(deletion);
  at.setUTCMonth(at.getUTCMonth() - months);
  at.setUTCDate(at.getUTCDate() - days);
  return at;
};

/**
 * The daily inactivity job: a person not signed in for two years is deleted (with their agents), after warnings to
 * every contact 6 months, 3 months, 1 month, 1 week and 1 day before, each sent once and in the account's language.
 * After days without a run, only the latest warning due goes out. Signing in starts the two years again.
 *
 * @example
 * await runInactivity(server, pictureStorage); // { warned: 3, deleted: 1 }
 */
export async function runInactivity(
  server: AccountServer,
  storage: PictureStorage,
  { now = Date.now() }: { now?: number } = {},
): Promise<{ warned: number; deleted: number }> {
  const at = new Date(now);
  const firstWarning = new Date(now);
  firstWarning.setUTCFullYear(firstWarning.getUTCFullYear() - YEARS);
  // A week's margin: the warnings' own dates decide (months have different lengths).
  firstWarning.setUTCMonth(firstWarning.getUTCMonth() + 6);
  firstWarning.setUTCDate(firstWarning.getUTCDate() + 7);
  const accounts = await server.database
    .selectFrom("account")
    .select(["id", "last_active_at", "language"])
    .where("kind", "=", "person")
    .where("last_active_at", "<=", firstWarning)
    .execute();
  let warned = 0;
  let deleted = 0;
  for (const account of accounts) {
    const deletion = deletionDate(account.last_active_at);
    if (deletion <= at) {
      const ledgerPepper = deriveSecret(server.secret, "banned-contact");
      await recordAuditEvent(server.database, { accountId: account.id, action: "account.inactive", now });
      await deleteAccount(server.database, storage, { accountId: account.id, ledgerPepper, now });
      deleted++;
      continue;
    }
    const due = STAGES.filter((stage) => before(deletion, stage) <= at).at(-1);
    if (!due) continue;
    const recorded = await server.database
      .insertInto("inactivity_warning")
      .values({
        id: uuidVersion7({ now }),
        account_id: account.id,
        stage: due.stage,
        active_at: account.last_active_at,
        sent_at: at,
      })
      .onConflict((conflict) => conflict.columns(["account_id", "stage", "active_at"]).doNothing())
      .returning("id")
      .executeTakeFirst();
    if (!recorded) continue;
    const contacts = await server.database
      .selectFrom("contact")
      .select(["kind", "value"])
      .where("account_id", "=", account.id)
      .where("verified_at", "is not", null)
      .execute();
    for (const contact of contacts) {
      const channel = server.channels.find(({ kind }) => kind === contact.kind);
      await channel?.notify?.({
        contact,
        language: account.language ?? "en",
        notice: { kind: "inactivity-warning", deletionAt: deletion },
      });
    }
    warned++;
  }
  return { warned, deleted };
}
