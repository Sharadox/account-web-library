import { expect, test } from "vitest";
import { effectivePermissions } from "@sharadox/account-web-library/effective-permissions";
import type { Grant, Role } from "@sharadox/account-web-library/effective-permissions/type";

const role = (id: string, application: string | null, permissions: string[], exclusive = false): Role => ({
  id,
  application,
  permissions,
  exclusive,
});
const grant = (roleId: string, application: string | null, extra: Partial<Grant> = {}): Grant => ({
  roleId,
  application,
  resource: null,
  startsAt: 0,
  endsAt: null,
  ...extra,
});

const roles = [
  role("platform-default", "platform", ["platform.job.read"]),
  role("platform-manager", "platform", ["platform.job.read", "platform.job.create", "platform.job.delete"]),
  role("shop-buyer", "shop", ["shop.order.create"]),
  role("platform-banned", "platform", ["account.ban.read", "account.data.export"], true),
  role("everywhere-banned", null, ["account.ban.read", "account.account.delete"], true),
  role("staff", null, ["platform.report.read", "shop.report.read"]),
];
const base = { application: "platform", now: 1_000, roles, defaultRole: roles[0]! };

const sorted = (permissions: Set<string>) => [...permissions].sort();

test("everyone has the application's default role", () => {
  expect(sorted(effectivePermissions({ ...base, grants: [] }))).toEqual(["platform.job.read"]);
});

test("adds every active role in the application, and global roles' permissions for it", () => {
  const grants = [grant("platform-manager", "platform"), grant("shop-buyer", "shop"), grant("staff", null)];
  expect(sorted(effectivePermissions({ ...base, grants }))).toEqual([
    "platform.job.create",
    "platform.job.delete",
    "platform.job.read",
    "platform.report.read",
  ]);
});

test("ignores grants not started yet or already ended (memberships, temporary bans)", () => {
  const grants = [
    grant("platform-manager", "platform", { startsAt: 2_000 }),
    grant("platform-banned", "platform", { endsAt: 1_000 }),
  ];
  expect(sorted(effectivePermissions({ ...base, grants }))).toEqual(["platform.job.read"]);
});

test("a ban (an exclusive role) leaves only its own permissions, whatever else is granted", () => {
  const grants = [grant("platform-manager", "platform"), grant("platform-banned", "platform", { endsAt: 5_000 })];
  expect(sorted(effectivePermissions({ ...base, grants }))).toEqual(["account.ban.read", "account.data.export"]);
});

test("a ban in one application doesn't touch another", () => {
  const grants = [grant("platform-banned", "platform"), grant("shop-buyer", "shop")];
  const shop = { ...base, application: "shop", defaultRole: role("shop-default", "shop", []) };
  expect(sorted(effectivePermissions({ ...shop, grants }))).toEqual(["shop.order.create"]);
});

test("a global ban covers every application", () => {
  const grants = [grant("everywhere-banned", null), grant("shop-buyer", "shop")];
  const shop = { ...base, application: "shop", defaultRole: role("shop-default", "shop", []) };
  expect(sorted(effectivePermissions({ ...shop, grants }))).toEqual(["account.account.delete", "account.ban.read"]);
});

test("a role limited to one resource counts only for that resource", () => {
  const grants = [grant("platform-manager", "platform", { resource: "platform:project:42" })];
  expect(sorted(effectivePermissions({ ...base, grants, resource: "platform:project:42" }))).toContain(
    "platform.job.delete",
  );
  expect(sorted(effectivePermissions({ ...base, grants, resource: "platform:project:7" }))).toEqual([
    "platform.job.read",
  ]);
  expect(sorted(effectivePermissions({ ...base, grants }))).toEqual(["platform.job.read"]);
});

test("a token or key gets at most its scope", () => {
  const grants = [grant("platform-manager", "platform")];
  expect(
    sorted(effectivePermissions({ ...base, grants, scope: ["platform.job.read", "platform.job.delete", "x"] })),
  ).toEqual(["platform.job.delete", "platform.job.read"]);
});

test("an agent gets at most what its owner holds right now", () => {
  const grants = [grant("platform-manager", "platform")];
  const ownerPermissions = new Set(["platform.job.read"]);
  expect(sorted(effectivePermissions({ ...base, grants, ownerPermissions }))).toEqual(["platform.job.read"]);
});

test("a grant whose role no longer exists gives nothing", () => {
  expect(sorted(effectivePermissions({ ...base, grants: [grant("deleted-role", "platform")] }))).toEqual([
    "platform.job.read",
  ]);
});
