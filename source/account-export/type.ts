import type { AccountActivityEvent } from "@sharadox/account-web-library/account-activity/type";

/** Everything stored about an account, for its owner to download (GDPR Art. 15 and 20). Dates are ISO 8601 text. */
export interface AccountExport {
  exportedAt: string;
  account: { id: string; kind: string; name: string; identifier: string; createdAt: string; lastActiveAt: string };
  contacts: {
    id: string;
    kind: string;
    value: string;
    verifiedAt: string | null;
    signIn: boolean;
    createdAt: string;
  }[];
  picture: { id: string; width: number; height: number; createdAt: string } | null;
  secondFactor: { authenticatorApp: boolean; recoveryCodesLeft: number };
  sessions: { userAgent: string | null; signedInAt: string; lastSeenAt: string }[];
  activity: (Omit<AccountActivityEvent, "at"> & { at: string })[];
}
