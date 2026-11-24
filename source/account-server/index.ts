import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountServer, SignInLimits } from "@sharadox/account-web-library/account-server/type";

/**
 * The limits used when a company's configuration doesn't set them: 3 codes per contact then one per 5 minutes; 10
 * per address group then one a minute; 200 for everyone then one a second; 20 typed codes per address group then
 * one per 30 seconds; 5 two-factor codes per account then one a minute; 2,000 sends per channel per UTC day; proof of work of 14 bits.
 */
export const DEFAULT_SIGN_IN_LIMITS: SignInLimits = {
  perContact: { capacity: 3, refillPerSecond: 1 / 300 },
  perAddress: { capacity: 10, refillPerSecond: 1 / 60 },
  global: { capacity: 200, refillPerSecond: 1 },
  verificationsPerAddress: { capacity: 20, refillPerSecond: 1 / 30 },
  secondFactorPerAccount: { capacity: 5, refillPerSecond: 1 / 60 },
  dailySendsPerChannel: 2_000,
  difficulty: 14,
};

/**
 * A server's limits: its own where set, the defaults elsewhere.
 *
 * @example
 * const { perContact } = signInLimits(server);
 */
export function signInLimits(server: AccountServer): SignInLimits {
  return { ...DEFAULT_SIGN_IN_LIMITS, ...server.limits };
}

/**
 * The server's database seen through the account tables alone, for helpers that take `Kysely<AccountDatabase>`
 * (its transactions then have that type too).
 *
 * @example
 * await accountTables(server).transaction().execute((transaction) => removeTotp(transaction, { accountId }));
 */
export function accountTables(server: AccountServer): Kysely<AccountDatabase> {
  return server.database;
}
