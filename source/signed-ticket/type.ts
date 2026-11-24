export interface TicketOptions {
  /** At least 32 characters, server only. */
  secret: string;
  /** What the ticket is for: a ticket for one purpose is refused for any other. */
  purpose: string;
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}

export type TicketReading<Data> = { valid: true; data: Data } | { valid: false; reason: "signature" | "expired" };
