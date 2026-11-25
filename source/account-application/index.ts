import type { ApplicationDeclaration } from "@sharadox/account-web-library/application-sync/type";

/**
 * The account system's own application: what its administration needs, synced at every start. The roles: the
 * administrator (everything), the moderator (bans and appeals), and the ban on the account site itself, which leaves
 * only what the law and the account's owner need (seeing the ban, appealing, the data download, deletion).
 */
export const ACCOUNT_APPLICATION: ApplicationDeclaration = {
  key: "account",
  name: "Account",
  permissions: [
    { key: "account.administration.read", description: "See the administration" },
    { key: "account.role.read", description: "See any account's roles and bans" },
    { key: "account.role.assign", description: "Give and take back roles (only those whose permissions one holds)" },
    { key: "account.ban.create", description: "Ban an account, citing the rules it broke" },
    { key: "account.appeal.decide", description: "Decide appeals" },
  ],
  roles: [
    {
      key: "administrator",
      name: "Administrator",
      permissions: [
        "account.administration.read",
        "account.role.read",
        "account.role.assign",
        "account.ban.create",
        "account.appeal.decide",
      ],
    },
    {
      key: "moderator",
      name: "Moderator",
      permissions: ["account.administration.read", "account.role.read", "account.ban.create", "account.appeal.decide"],
    },
    { key: "banned", name: "Banned", permissions: [], exclusive: true },
  ],
};
