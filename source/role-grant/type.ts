export interface RoleGrantRequest {
  accountId: string;
  /** The role's application key (`platform`). */
  application: string;
  /** The role's key (`manager`). */
  role: string;
  /** `platform:project:42`; the whole application without it. */
  resource?: string;
  /** Milliseconds since 1970 (now by default). */
  startsAt?: number;
  /** Milliseconds since 1970; for good without it. */
  endsAt?: number;
  source?: "manual" | "membership" | "ban" | "system";
  /** Who gives it: they need `account.role.assign` and every permission of the role. The system without it. */
  grantedBy?: string;
  reason?: string;
  now?: number;
}

export type RoleGrantResult =
  | { granted: true; grantId: string }
  | { granted: false; reason: "no-role" | "no-account" | "not-allowed" | "escalation" };

/** A grant as an account's page or an administrator sees it. */
export interface GrantView {
  grantId: string;
  application: string | null;
  role: string;
  roleName: string;
  resource: string | null;
  startsAt: Date;
  endsAt: Date | null;
  source: string;
  reason: string | null;
  /** Started and not ended. */
  active: boolean;
}
