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
  {
    name: "0004-identifier-name-picture-second-factor",
    sql: `
      alter table application rename constraint application_id_check to application_key_check;
      alter table application rename column id to key;
      alter table application drop constraint application_pkey;
      alter table application add constraint application_key_key unique (key);
      alter table application
        add column id uuid primary key default uuidv7() check (uuid_extract_version(id) = 7);

      alter table audit_event add column application_id uuid
        references application (id) on update cascade on delete restrict;
      alter table audit_event disable trigger audit_event_unchangeable;
      update audit_event set application_id = application.id from application
        where audit_event.application = application.key;
      alter table audit_event enable trigger audit_event_unchangeable;
      alter table audit_event drop column application;

      create table identifier (
        id uuid primary key check (uuid_extract_version(id) = 7),
        value text not null
          check (length(value) between 1 and 50 and value ~ '^[A-Za-z0-9]+([-_.][A-Za-z0-9]+)*$'),
        account_id uuid unique references account (id) on update cascade on delete cascade,
        created_at timestamptz not null default now(),
        constraint identifier_owner_check check (num_nonnulls(account_id) = 1)
      );
      create unique index identifier_value_key on identifier (lower(value));
      insert into identifier (id, value, account_id) select uuidv7(), username, id from account;

      alter table account add column name text
        check (length(name) between 1 and 50 and name = btrim(name) and name !~ '[[:cntrl:]]');
      update account set name = username;
      alter table account alter column name set not null;
      alter table account drop column username;

      create function account_require_identifier(target uuid) returns void
      language plpgsql set search_path = public as $$
      begin
        if exists (select 1 from account where id = target)
          and not exists (select 1 from identifier where account_id = target) then
          raise exception 'an account needs an identifier' using errcode = '23514';
        end if;
      end $$;
      create function account_identifier_after_insert() returns trigger
      language plpgsql set search_path = public as $$
      begin
        perform account_require_identifier(new.id);
        return null;
      end $$;
      create function identifier_after_change() returns trigger
      language plpgsql set search_path = public as $$
      begin
        if old.account_id is not null then
          perform account_require_identifier(old.account_id);
        end if;
        return null;
      end $$;
      create constraint trigger account_identifier after insert on account
        deferrable initially deferred for each row execute function account_identifier_after_insert();
      create constraint trigger identifier_owner after update or delete on identifier
        deferrable initially deferred for each row execute function identifier_after_change();

      alter table account drop constraint account_owner_id_fkey, add constraint account_owner_id_fkey
        foreign key (owner_id) references account (id) on update cascade on delete cascade;
      alter table contact drop constraint contact_account_id_fkey, add constraint contact_account_id_fkey
        foreign key (account_id) references account (id) on update cascade on delete cascade;
      alter table account_session drop constraint account_session_browser_session_id_fkey,
        add constraint account_session_browser_session_id_fkey foreign key (browser_session_id)
          references browser_session (id) on update cascade on delete cascade;
      alter table account_session drop constraint account_session_account_id_fkey,
        add constraint account_session_account_id_fkey
          foreign key (account_id) references account (id) on update cascade on delete cascade;
      delete from code_request where account_id is not null
        and not exists (select 1 from account where account.id = code_request.account_id);
      alter table code_request add constraint code_request_account_id_fkey
        foreign key (account_id) references account (id) on update cascade on delete cascade;

      create table account_picture (
        id uuid primary key check (uuid_extract_version(id) = 7),
        account_id uuid not null unique references account (id) on update cascade on delete cascade,
        content_type text not null check (content_type in
          ('image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml')),
        byte_size integer not null check (byte_size between 1 and 5242880),
        width integer not null check (width between 1 and 4096),
        height integer not null check (height between 1 and 4096),
        created_at timestamptz not null default now()
      );

      create table totp_credential (
        id uuid primary key check (uuid_extract_version(id) = 7),
        account_id uuid not null unique references account (id) on update cascade on delete cascade,
        secret_ciphertext text not null,
        last_used_step bigint,
        created_at timestamptz not null default now(),
        confirmed_at timestamptz
      );

      create table recovery_code (
        id uuid primary key check (uuid_extract_version(id) = 7),
        account_id uuid not null references account (id) on update cascade on delete cascade,
        code_hash text not null,
        created_at timestamptz not null default now(),
        used_at timestamptz,
        unique (account_id, code_hash)
      );

      alter table browser_session add column user_agent text check (length(user_agent) <= 500);
      alter table account_session add column step_up_at timestamptz;
    `,
  },
  {
    name: "0005-role",
    sql: `
      create table permission (
        id uuid primary key check (uuid_extract_version(id) = 7),
        application_id uuid not null references application (id) on update cascade on delete cascade,
        key text not null unique
          check (length(key) <= 100 and key ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*(\\.[a-z][a-z0-9]*(-[a-z0-9]+)*)+$'),
        description text not null default '' check (length(description) <= 500),
        created_at timestamptz not null default now()
      );

      create table role (
        id uuid primary key check (uuid_extract_version(id) = 7),
        application_id uuid references application (id) on update cascade on delete cascade,
        key text not null check (length(key) <= 50 and key ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
        name text not null check (length(name) between 1 and 100),
        exclusive boolean not null default false,
        is_default boolean not null default false,
        created_at timestamptz not null default now(),
        constraint role_default_check check (not (is_default and (exclusive or application_id is null)))
      );
      create unique index role_key on role (coalesce(application_id::text, ''), key);
      create unique index role_default on role (application_id) where is_default;

      create table role_permission (
        id uuid primary key check (uuid_extract_version(id) = 7),
        role_id uuid not null references role (id) on update cascade on delete cascade,
        permission_id uuid not null references permission (id) on update cascade on delete cascade,
        unique (role_id, permission_id)
      );

      create table role_grant (
        id uuid primary key check (uuid_extract_version(id) = 7),
        account_id uuid not null references account (id) on update cascade on delete cascade,
        role_id uuid not null references role (id) on update cascade on delete restrict,
        resource text check (length(resource) <= 200),
        starts_at timestamptz not null default now(),
        ends_at timestamptz,
        source text not null check (source in ('manual', 'membership', 'ban', 'system')),
        granted_by uuid references account (id) on update cascade on delete set null,
        reason text check (length(reason) <= 1000),
        created_at timestamptz not null default now(),
        constraint role_grant_check check (ends_at is null or ends_at > starts_at)
      );
      create index role_grant_account on role_grant (account_id);
      create index role_grant_role on role_grant (role_id);
    `,
  },
  {
    name: "0006-rule-ban",
    sql: `
      create table rule (
        id uuid primary key check (uuid_extract_version(id) = 7),
        application_id uuid references application (id) on update cascade on delete cascade,
        code text not null check (length(code) <= 50 and code ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
        version integer not null check (version >= 1),
        title jsonb not null,
        description jsonb not null,
        schedule jsonb not null check (jsonb_typeof(schedule) = 'array' and jsonb_array_length(schedule) >= 1),
        created_at timestamptz not null default now()
      );
      create unique index rule_version_key on rule (coalesce(application_id::text, ''), code, version);

      create table ban (
        id uuid primary key check (uuid_extract_version(id) = 7),
        grant_id uuid not null unique references role_grant (id) on update cascade on delete cascade,
        account_id uuid not null references account (id) on update cascade on delete cascade,
        statement text not null check (length(statement) between 1 and 2000),
        evidence text check (length(evidence) <= 5000),
        penalty text not null check (penalty = 'permanent' or penalty ~ '^[0-9]+$'),
        created_by uuid references account (id) on update cascade on delete set null,
        created_at timestamptz not null default now()
      );
      create index ban_account on ban (account_id);

      create table ban_rule (
        id uuid primary key check (uuid_extract_version(id) = 7),
        ban_id uuid not null references ban (id) on update cascade on delete cascade,
        rule_id uuid not null references rule (id) on update cascade on delete restrict,
        unique (ban_id, rule_id)
      );

      create table appeal (
        id uuid primary key check (uuid_extract_version(id) = 7),
        ban_id uuid not null unique references ban (id) on update cascade on delete cascade,
        text text not null check (length(text) between 1 and 5000),
        created_at timestamptz not null default now(),
        decision text check (decision in ('upheld', 'shortened', 'lifted')),
        reasons text check (length(reasons) <= 5000),
        decided_by uuid references account (id) on update cascade on delete set null,
        decided_at timestamptz
      );

      create table banned_contact (
        id uuid primary key check (uuid_extract_version(id) = 7),
        contact_hash text not null,
        application_id uuid references application (id) on update cascade on delete cascade,
        ends_at timestamptz,
        rule_codes text[] not null,
        created_at timestamptz not null default now()
      );
      create index banned_contact_hash on banned_contact (contact_hash);
    `,
  },
  {
    name: "0007-language-inactivity",
    sql: `
      alter table account add column language text check (length(language) <= 20);

      create table inactivity_warning (
        id uuid primary key check (uuid_extract_version(id) = 7),
        account_id uuid not null references account (id) on update cascade on delete cascade,
        stage text not null check (stage in ('6-months', '3-months', '1-month', '1-week', '1-day')),
        active_at timestamptz not null,
        sent_at timestamptz not null default now(),
        unique (account_id, stage, active_at)
      );
    `,
  },
  {
    name: "0008-method-notification-birthday",
    sql: `
      -- Deleting a role takes it from everyone who held it (the administration page says how many first).
      alter table role_grant drop constraint role_grant_role_id_fkey, add constraint role_grant_role_id_fkey
        foreign key (role_id) references role (id) on update cascade on delete cascade;

      -- Any number of authenticator apps, each named; any contact or authenticator can be required at every sign-in.
      alter table totp_credential drop constraint totp_credential_account_id_key;
      create index totp_credential_account on totp_credential (account_id);
      alter table totp_credential
        add column name text not null default 'Authenticator'
          constraint totp_credential_name_check check (length(name) between 1 and 50),
        add column required boolean not null default false;
      alter table totp_credential alter column name drop default;
      -- Two-factor as it was: an authenticator already on stays asked for at every sign-in.
      update totp_credential set required = true where confirmed_at is not null;
      alter table contact add column required boolean not null default false;

      create table notification (
        id uuid primary key check (uuid_extract_version(id) = 7),
        account_id uuid not null references account (id) on update cascade on delete cascade,
        kind text not null check (length(kind) <= 50),
        detail jsonb not null default '{}',
        created_at timestamptz not null default now(),
        read_at timestamptz
      );
      create index notification_account on notification (account_id, created_at desc);

      create table notification_preference (
        id uuid primary key check (uuid_extract_version(id) = 7),
        account_id uuid not null references account (id) on update cascade on delete cascade,
        kind text not null check (length(kind) <= 50),
        channel text not null constraint notification_preference_channel_check check (channel in ('in-app', 'email')),
        enabled boolean not null,
        unique (account_id, kind, channel)
      );

      -- A birthday: day and month, the year if given, a date that exists.
      alter table account
        add column birth_day smallint constraint account_birth_day_check check (birth_day between 1 and 31),
        add column birth_month smallint constraint account_birth_month_check check (birth_month between 1 and 12),
        add column birth_year smallint constraint account_birth_year_check check (birth_year between 1900 and 2100),
        add constraint account_birth_check check (
          (birth_day is null) = (birth_month is null)
          and (birth_year is null or birth_day is not null)
          and (birth_day is null or birth_day <= case
            when birth_month = 2 then 29 when birth_month in (4, 6, 9, 11) then 30 else 31 end)
          and (birth_year is null or birth_month <> 2 or birth_day <> 29
            or (birth_year % 4 = 0 and (birth_year % 100 <> 0 or birth_year % 400 = 0)))
        );
    `,
  },
  {
    name: "0009-optional-authenticator-name",
    sql: `
      -- An authenticator's name is optional: without one, the date it was added tells it apart.
      alter table totp_credential alter column name drop not null;
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
