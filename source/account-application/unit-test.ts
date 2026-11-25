import { expect, test } from "vitest";
import { ACCOUNT_APPLICATION } from "@sharadox/account-web-library/account-application";

test("the account system's own permissions, every role's among them, and a ban role", () => {
  const permissions = new Set(ACCOUNT_APPLICATION.permissions.map(({ key }) => key));
  for (const role of ACCOUNT_APPLICATION.roles)
    for (const permission of role.permissions) expect(permissions.has(permission)).toBe(true);
  expect(ACCOUNT_APPLICATION.roles.some(({ exclusive }) => exclusive)).toBe(true);
  expect(ACCOUNT_APPLICATION.key).toBe("account");
});
