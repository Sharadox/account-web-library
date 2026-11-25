import type { Kysely } from "kysely";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type { BanRequest, BanResult, BanView } from "@sharadox/account-web-library/account-ban/type";
import { accountPermissions } from "@sharadox/account-web-library/account-permission";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { banLength } from "@sharadox/account-web-library/ban-length";
import { revokeGrant } from "@sharadox/account-web-library/role-grant";

/** Banning, in the account system's own application. */
export const BAN_PERMISSION = "account.ban.create";
/** Deciding appeals, in the account system's own application. */
export const APPEAL_PERMISSION = "account.appeal.decide";

const allowed = async (database: Kysely<AccountDatabase>, accountId: string, permission: string) =>
  (await accountPermissions(database, { accountId, application: "account" })).has(permission);

/**
 * Bans an account in an application for breaking rules: the length comes from the rules' penalty schedules (this
 * offense for each, counted per account, rule and application; the longest wins), so equal offenses get equal
 * penalties. The ban is the application's exclusive role, granted until then (or for good), with a record of the
 * rule versions broken and the statement of reasons. Recorded in the audit log.
 *
 * @example
 * await banAccount(database, { accountId, application: "platform", rules: ["spam"], statement, by: moderator });
 */
export async function banAccount(
  database: Kysely<AccountDatabase>,
  { accountId, application, rules, statement, evidence, by, now = Date.now() }: BanRequest,
): Promise<BanResult> {
  if (by && !(await allowed(database, by, BAN_PERMISSION))) return { banned: false, reason: "not-allowed" };
  const app = await database
    .selectFrom("application")
    .select("id")
    .where("key", "=", application)
    .executeTakeFirstOrThrow();
  if (rules.length === 0) return { banned: false, reason: "no-rule", detail: "" };
  const cited: { id: string; code: string; schedule: (number | "permanent")[] }[] = [];
  for (const code of rules) {
    const rule = await database
      .selectFrom("rule")
      .select(["id", "code", "schedule"])
      .where("code", "=", code)
      .where((where) => where.or([where("application_id", "=", app.id), where("application_id", "is", null)]))
      .orderBy("version", "desc")
      .executeTakeFirst();
    if (!rule) return { banned: false, reason: "no-rule", detail: code };
    cited.push(rule);
  }
  const role = await database
    .selectFrom("role")
    .select("id")
    .where("application_id", "=", app.id)
    .where("exclusive", "=", true)
    .orderBy("key")
    .executeTakeFirst();
  if (!role) return { banned: false, reason: "no-ban-role" };
  const broken = [];
  for (const rule of cited) {
    const previous = await database
      .selectFrom("ban_rule")
      .innerJoin("rule", "rule.id", "ban_rule.rule_id")
      .innerJoin("ban", "ban.id", "ban_rule.ban_id")
      .select((select) => select.fn.countAll<string>().as("count"))
      .where("ban.account_id", "=", accountId)
      .where("rule.code", "=", rule.code)
      .where("rule.application_id", "is not distinct from", app.id)
      .executeTakeFirstOrThrow();
    broken.push({ schedule: rule.schedule, previousOffenses: Number(previous.count) });
  }
  const penalty = banLength(broken);
  const endsAt = penalty === "permanent" ? null : new Date(now + penalty * 1000);
  const banId = uuidVersion7({ now });
  await database.transaction().execute(async (transaction) => {
    const grantId = uuidVersion7({ now });
    await transaction
      .insertInto("role_grant")
      .values({
        id: grantId,
        account_id: accountId,
        role_id: role.id,
        starts_at: new Date(now),
        ends_at: endsAt,
        source: "ban",
        granted_by: by ?? null,
        reason: statement,
      })
      .execute();
    await transaction
      .insertInto("ban")
      .values({
        id: banId,
        grant_id: grantId,
        account_id: accountId,
        statement,
        evidence: evidence ?? null,
        penalty: String(penalty),
        created_by: by ?? null,
      })
      .execute();
    await transaction
      .insertInto("ban_rule")
      .values(cited.map((rule) => ({ id: uuidVersion7({ now }), ban_id: banId, rule_id: rule.id })))
      .execute();
    await recordAuditEvent(transaction, {
      accountId,
      actorAccountId: by ?? null,
      application,
      action: "ban.created",
      detail: { banId, rules, penalty },
      now,
    });
  });
  return { banned: true, banId, endsAt };
}

/**
 * The one appeal a ban may have, written by the banned account.
 *
 * @example
 * await appealBan(database, { banId, accountId, text });
 */
export async function appealBan(
  database: Kysely<AccountDatabase>,
  { banId, accountId, text, now = Date.now() }: { banId: string; accountId: string; text: string; now?: number },
): Promise<{ appealed: true; appealId: string } | { appealed: false; reason: "no-ban" | "already-appealed" }> {
  const ban = await database
    .selectFrom("ban")
    .select("id")
    .where("id", "=", banId)
    .where("account_id", "=", accountId)
    .executeTakeFirst();
  if (!ban) return { appealed: false, reason: "no-ban" };
  const existing = await database.selectFrom("appeal").select("id").where("ban_id", "=", banId).executeTakeFirst();
  if (existing) return { appealed: false, reason: "already-appealed" };
  // The database still refuses a second one sent at the same moment (unique ban_id).
  const appealId = uuidVersion7({ now });
  await database
    .insertInto("appeal")
    .values({ id: appealId, ban_id: banId, text, created_at: new Date(now) })
    .execute();
  await recordAuditEvent(database, { accountId, action: "ban.appealed", detail: { banId, appealId }, now });
  return { appealed: true, appealId };
}

/**
 * A moderator's decision on an appeal, with its reasons: `upheld` keeps the ban, `shortened` moves its end to
 * `endsAt`, `lifted` ends it now. Decided once.
 *
 * @example
 * await decideAppeal(database, { appealId, by: moderator, decision: "lifted", reasons });
 */
export async function decideAppeal(
  database: Kysely<AccountDatabase>,
  {
    appealId,
    by,
    decision,
    reasons,
    endsAt,
    now = Date.now(),
  }: {
    appealId: string;
    by: string;
    decision: "upheld" | "shortened" | "lifted";
    reasons: string;
    endsAt?: number;
    now?: number;
  },
): Promise<{ decided: true } | { decided: false; reason: "not-allowed" | "no-appeal" | "already-decided" }> {
  if (!(await allowed(database, by, APPEAL_PERMISSION))) return { decided: false, reason: "not-allowed" };
  const appeal = await database
    .selectFrom("appeal")
    .innerJoin("ban", "ban.id", "appeal.ban_id")
    .select(["appeal.decision", "ban.grant_id", "ban.account_id", "ban.id as banId"])
    .where("appeal.id", "=", appealId)
    .executeTakeFirst();
  if (!appeal) return { decided: false, reason: "no-appeal" };
  if (appeal.decision) return { decided: false, reason: "already-decided" };
  if (decision === "lifted") await revokeGrant(database, { grantId: appeal.grant_id, revokedBy: by, now });
  if (decision === "shortened" && endsAt !== undefined)
    await database
      .updateTable("role_grant")
      .set({ ends_at: new Date(endsAt) })
      .where("id", "=", appeal.grant_id)
      .execute();
  await database
    .updateTable("appeal")
    .set({ decision, reasons, decided_by: by, decided_at: new Date(now) })
    .where("id", "=", appealId)
    .execute();
  await recordAuditEvent(database, {
    accountId: appeal.account_id,
    actorAccountId: by,
    action: "ban.appeal-decided",
    detail: { banId: appeal.banId, appealId, decision },
    now,
  });
  return { decided: true };
}

/**
 * An account's bans, newest first: the rules cited, the statement, the penalty, when it ends, whether it is active,
 * and its appeal.
 *
 * @example
 * const bans = await listBans(database, { accountId });
 */
export async function listBans(
  database: Kysely<AccountDatabase>,
  { accountId, now = Date.now() }: { accountId: string; now?: number },
): Promise<BanView[]> {
  const bans = await database
    .selectFrom("ban")
    .innerJoin("role_grant", "role_grant.id", "ban.grant_id")
    .innerJoin("role", "role.id", "role_grant.role_id")
    .leftJoin("application", "application.id", "role.application_id")
    .leftJoin("appeal", "appeal.ban_id", "ban.id")
    .select([
      "ban.id as banId",
      "application.key as application",
      "ban.statement",
      "ban.penalty",
      "role_grant.starts_at as startsAt",
      "role_grant.ends_at as endsAt",
      "appeal.id as appealId",
      "appeal.text as appealText",
      "appeal.decision",
      "appeal.reasons",
    ])
    .where("ban.account_id", "=", accountId)
    .orderBy("ban.id", "desc")
    .execute();
  const views: BanView[] = [];
  for (const ban of bans) {
    const rules = await database
      .selectFrom("ban_rule")
      .innerJoin("rule", "rule.id", "ban_rule.rule_id")
      .select("rule.code")
      .where("ban_rule.ban_id", "=", ban.banId)
      .orderBy("rule.code")
      .execute();
    views.push({
      banId: ban.banId,
      application: ban.application,
      rules: rules.map(({ code }) => code),
      statement: ban.statement,
      penalty: ban.penalty,
      startsAt: ban.startsAt,
      endsAt: ban.endsAt,
      active: ban.startsAt.getTime() <= now && (ban.endsAt === null || now < ban.endsAt.getTime()),
      appeal: ban.appealId
        ? { appealId: ban.appealId, text: ban.appealText!, decision: ban.decision, reasons: ban.reasons }
        : null,
    });
  }
  return views;
}
