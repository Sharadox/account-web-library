export interface BanRequest {
  accountId: string;
  /** The application's key (`platform`): its exclusive role is the ban. */
  application: string;
  /** The codes of the rules broken (newest versions), the application's own or global. */
  rules: string[];
  /** The statement of reasons the account is shown. */
  statement: string;
  evidence?: string;
  /** The moderator: needs `account.ban.create`. The system without it. */
  by?: string;
  now?: number;
}

export type BanResult =
  | { banned: true; banId: string; endsAt: Date | null }
  | { banned: false; reason: "not-allowed" | "no-ban-role" }
  | { banned: false; reason: "no-rule"; detail: string };

/** A ban as the banned account, or a moderator, sees it. */
export interface BanView {
  banId: string;
  application: string | null;
  rules: string[];
  statement: string;
  /** Seconds, or "permanent". */
  penalty: string;
  startsAt: Date;
  endsAt: Date | null;
  active: boolean;
  appeal: { appealId: string; text: string; decision: string | null; reasons: string | null } | null;
}
