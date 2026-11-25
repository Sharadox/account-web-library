import type { Kysely } from "kysely";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type { PublishedRule, RuleDeclaration } from "@sharadox/account-web-library/rule-sync/type";

const same = (first: unknown, second: unknown) => JSON.stringify(first) === JSON.stringify(second);

/** The application's id; null for global rules; undefined when it doesn't exist. */
async function applicationId(database: Kysely<AccountDatabase>, key: string | null) {
  if (key === null) return null;
  return (await database.selectFrom("application").select("id").where("key", "=", key).executeTakeFirst())?.id;
}

/**
 * Publishes an application's rules (or global ones, `application: null`). A rule whose words or penalties changed gets
 * a new version, and earlier bans keep citing the version they broke. Returns the codes given a new version.
 *
 * @example
 * await syncRules(database, { application: "platform", rules: [{ code: "spam", title, description, schedule }] });
 */
export async function syncRules(
  database: Kysely<AccountDatabase>,
  { application, rules }: { application: string | null; rules: RuleDeclaration[] },
): Promise<{ versioned: string[]; unknownApplication?: true }> {
  const id = await applicationId(database, application);
  if (id === undefined) return { versioned: [], unknownApplication: true };
  const versioned: string[] = [];
  for (const rule of rules) {
    let latest = database.selectFrom("rule").selectAll().where("code", "=", rule.code);
    latest = id === null ? latest.where("application_id", "is", null) : latest.where("application_id", "=", id);
    const current = await latest.orderBy("version", "desc").executeTakeFirst();
    if (
      current &&
      same(current.title, rule.title) &&
      same(current.description, rule.description) &&
      same(current.schedule, rule.schedule)
    )
      continue;
    await database
      .insertInto("rule")
      .values({
        id: uuidVersion7(),
        application_id: id,
        code: rule.code,
        version: (current?.version ?? 0) + 1,
        title: JSON.stringify(rule.title),
        description: JSON.stringify(rule.description),
        schedule: JSON.stringify(rule.schedule),
      })
      .execute();
    versioned.push(rule.code);
  }
  return { versioned };
}

/**
 * The rules in force for an application, newest versions, global ones first then its own, by code: what the public
 * rules page and `GET /api/rules` show.
 *
 * @example
 * const rules = await listRules(database, { application: "platform" });
 */
export async function listRules(
  database: Kysely<AccountDatabase>,
  { application }: { application: string },
): Promise<PublishedRule[]> {
  const id = await applicationId(database, application);
  const rows = await database
    .selectFrom("rule")
    .selectAll()
    .where((where) =>
      id
        ? where.or([where("application_id", "is", null), where("application_id", "=", id)])
        : where("application_id", "is", null),
    )
    .orderBy("version", "desc")
    .execute();
  const newest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = `${row.application_id === null ? "0" : "1"}:${row.code}`;
    if (!newest.has(key)) newest.set(key, row);
  }
  return [...newest.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([, row]) => ({
      code: row.code,
      version: row.version,
      title: row.title,
      description: row.description,
      schedule: row.schedule,
      global: row.application_id === null,
    }));
}
