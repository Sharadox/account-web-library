import type { Kysely } from "kysely";
import { migrate } from "@sharadox/database-web-library/migration";
import type { Migration } from "@sharadox/database-web-library/migration/type";

/** The table that records which account migrations a database has applied (apart from the application's own). */
export const ACCOUNT_MIGRATION_TABLE = "account_migration";

/**
 * The account tables, forward only. The database enforces the rules itself, as the last line behind the code:
 * UUIDv7 ids, username rules and case-insensitive uniqueness, one account per verified contact, agents owned by a
 * person, every person keeping a verified sign-in contact (checked at commit), and an audit log that is never changed.
 */
export const accountMigrations: Migration[] = [
  {
    name: "0001-application-account-contact-audit",
    sql: `
      create table application (
        id text primary key check (id ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' and length(id) <= 50),
        name text not null,
        created_at timestamptz not null default now()
      );
      insert into application (id, name) values ('account', 'Account');

      create table account (
        id uuid primary key check (uuid_extract_version(id) = 7),
        kind text not null check (kind in ('person', 'agent')),
        username text not null
          check (length(username) between 1 and 50 and username ~ '^[A-Za-z0-9]+([-_.][A-Za-z0-9]+)*$'),
        owner_id uuid references account (id) on delete cascade,
        created_at timestamptz not null default now(),
        last_active_at timestamptz not null default now(),
        constraint account_owner_check check ((kind = 'agent') = (owner_id is not null))
      );
      create unique index account_username_key on account (lower(username));
      create index account_owner on account (owner_id) where owner_id is not null;
      create index account_last_active_at on account (last_active_at);

      create table contact (
        id uuid primary key check (uuid_extract_version(id) = 7),
        account_id uuid not null references account (id) on delete cascade,
        kind text not null check (kind ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
        value text not null check (length(value) between 1 and 320),
        verified_at timestamptz,
        sign_in boolean not null default true,
        created_at timestamptz not null default now()
      );
      create unique index contact_verified on contact (kind, value) where verified_at is not null;
      create unique index contact_per_account on contact (account_id, kind, value);

      create function account_require_sign_in_contact(target uuid) returns void
      language plpgsql set search_path = public as $$
      begin
        if exists (select 1 from account where id = target and kind = 'person')
          and not exists (
            select 1 from contact where account_id = target and verified_at is not null and sign_in
          ) then
          raise exception 'a person account needs at least one verified sign-in contact' using errcode = '23514';
        end if;
      end $$;
      create function account_after_insert() returns trigger
      language plpgsql set search_path = public as $$
      begin
        perform account_require_sign_in_contact(new.id);
        return null;
      end $$;
      create function contact_after_change() returns trigger
      language plpgsql set search_path = public as $$
      begin
        perform account_require_sign_in_contact(old.account_id);
        return null;
      end $$;
      create constraint trigger account_sign_in_contact after insert on account
        deferrable initially deferred for each row execute function account_after_insert();
      create constraint trigger contact_sign_in_contact after update or delete on contact
        deferrable initially deferred for each row execute function contact_after_change();

      create table audit_event (
        id uuid primary key check (uuid_extract_version(id) = 7),
        at timestamptz not null default now(),
        account_id uuid,
        actor_account_id uuid,
        application text,
        action text not null check (length(action) between 1 and 100),
        detail jsonb not null default '{}'
      );
      create index audit_event_account on audit_event (account_id, at);
      create function audit_event_unchangeable() returns trigger
      language plpgsql as $$
      begin
        raise exception 'audit events are never changed';
      end $$;
      create trigger audit_event_unchangeable before update on audit_event
        for each row execute function audit_event_unchangeable();
    `,
  },
  {
    name: "0002-code-request",
    sql: `
      create table code_request (
        id uuid primary key check (uuid_extract_version(id) = 7),
        purpose text not null check (purpose in ('sign-in', 'contact-verification', 'step-up')),
        account_id uuid,
        kind text not null,
        value text not null,
        code_hash text not null,
        created_at timestamptz not null,
        expires_at timestamptz not null,
        attempts integer not null default 0 check (attempts >= 0),
        used_at timestamptz,
        voided_at timestamptz
      );
      create index code_request_open on code_request (kind, value, purpose) where used_at is null and voided_at is null;
      create index code_request_expires_at on code_request (expires_at);
    `,
  },
  {
    name: "0003-session",
    sql: `
      create table browser_session (
        id uuid primary key check (uuid_extract_version(id) = 7),
        token_hash text not null unique,
        created_at timestamptz not null,
        last_seen_at timestamptz not null,
        expires_at timestamptz not null
      );
      create index browser_session_expires_at on browser_session (expires_at);
      create table account_session (
        id uuid primary key check (uuid_extract_version(id) = 7),
        browser_session_id uuid not null references browser_session (id) on delete cascade,
        account_id uuid not null references account (id) on delete cascade,
        created_at timestamptz not null,
        last_seen_at timestamptz not null,
        expires_at timestamptz not null,
        second_factor_at timestamptz,
        unique (browser_session_id, account_id)
      );
      create index account_session_account on account_session (account_id);
    `,
  },
];

/**
 * Creates or updates the account tables, tracked in their own migration table. Returns the names applied.
 *
 * @example
 * await migrateAccount(database);
 */
export function migrateAccount<Schema>(database: Kysely<Schema>): Promise<string[]> {
  return migrate(database, accountMigrations, { table: ACCOUNT_MIGRATION_TABLE });
}
