import type { Kysely } from "kysely";
import type { TokenBucketRule } from "@sharadox/protection-web-library/token-bucket/type";
import type { AccountServerDatabase } from "@sharadox/account-web-library/account-database/type";
import type { ContactChannel } from "@sharadox/account-web-library/contact-channel/type";

/** How fast each kind of visitor may go. Every field has a default (see `DEFAULT_SIGN_IN_LIMITS`). */
export interface SignInLimits {
  /** Codes sent to one contact. */
  perContact: TokenBucketRule;
  /** Codes requested from one address group (an IPv4 address, an IPv6 /64). */
  perAddress: TokenBucketRule;
  /** Codes requested by everyone together. */
  global: TokenBucketRule;
  /** Codes typed from one address group. */
  verificationsPerAddress: TokenBucketRule;
  /** The most codes each channel may send in a UTC day; past it, sending pauses (never spends). */
  dailySendsPerChannel: number;
  /** Leading zero bits of the proof of work. */
  difficulty: number;
}

/** What every sign-in step needs: the database, the channels, and one root secret every key is derived from. */
export interface AccountServer {
  database: Kysely<AccountServerDatabase>;
  channels: ContactChannel[];
  /** At least 32 random characters, server only (`ACCOUNT_SECRET`). */
  secret: string;
  limits?: Partial<SignInLimits>;
}
