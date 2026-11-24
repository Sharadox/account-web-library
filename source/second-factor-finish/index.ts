import { addressGroup } from "@sharadox/protection-web-library/address-group";
import { limitRate } from "@sharadox/protection-web-library/rate-limit";
import { accountTables, signInLimits } from "@sharadox/account-web-library/account-server";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { signIn } from "@sharadox/account-web-library/account-sign-in";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { recoveryCodeHash } from "@sharadox/account-web-library/recovery-code-store";
import { decryptSecret } from "@sharadox/account-web-library/secret-encryption";
import { deriveSecret } from "@sharadox/account-web-library/secret-derivation";
import type {
  SecondFactorFinish,
  SecondFactorFinishResult,
} from "@sharadox/account-web-library/second-factor-finish/type";
import { readTicket } from "@sharadox/account-web-library/signed-ticket";
import { verifyTotp } from "@sharadox/account-web-library/totp";

/**
 * The two-factor step of signing in: the authenticator app's code (never the same step twice) or a single-use
 * recovery code, after the emailed code passed (`finishSignIn` gave the ticket). Guesses are limited per account and
 * per address group. The session is marked as having passed two-factor.
 *
 * @example
 * const result = await finishSecondFactor(server, { ticket, code, address, token: cookie });
 */
export async function finishSecondFactor(
  server: AccountServer,
  { ticket, code, address, token, userAgent = null, now = Date.now() }: SecondFactorFinish,
): Promise<SecondFactorFinishResult> {
  const reading = readTicket<{ accountId: string }>(ticket, {
    secret: deriveSecret(server.secret, "second-factor-ticket"),
    purpose: "second-factor",
    now,
  });
  if (!reading.valid) return { status: "refused", reason: "ticket" };
  const { accountId } = reading.data;
  const limits = signInLimits(server);
  const rate = await limitRate(
    server.database,
    [
      { key: `second-factor:${accountId}`, rule: limits.secondFactorPerAccount },
      { key: `verification:${addressGroup(address)}`, rule: limits.verificationsPerAddress },
    ],
    { secret: deriveSecret(server.secret, "rate-limit"), now },
  );
  if (!rate.allowed) return { status: "refused", reason: "rate-limit", retryAfterSeconds: rate.retryAfterSeconds };
  const passed = await accountTables(server)
    .transaction()
    .execute(async (transaction) => {
      const credential = await transaction
        .selectFrom("totp_credential")
        .select(["id", "secret_ciphertext", "last_used_step"])
        .where("account_id", "=", accountId)
        .where("confirmed_at", "is not", null)
        .forUpdate()
        .executeTakeFirst();
      // Two-factor was turned off since the emailed code passed: that code is the proof.
      if (!credential) return true;
      const typed = code.replace(/\s/g, "");
      const secret = decryptSecret(credential.secret_ciphertext, deriveSecret(server.secret, "totp-encryption"));
      // Confirming the setup stored a step, so a confirmed credential always has one.
      const lastUsedStep = Number(credential.last_used_step);
      const verification = verifyTotp(secret, typed, now, { lastUsedStep });
      if (verification.valid) {
        await transaction
          .updateTable("totp_credential")
          .set({ last_used_step: verification.step })
          .where("id", "=", credential.id)
          .execute();
        return true;
      }
      const used = await transaction
        .updateTable("recovery_code")
        .set({ used_at: new Date(now) })
        .where("account_id", "=", accountId)
        .where(
          "code_hash",
          "=",
          recoveryCodeHash(code, { accountId, pepper: deriveSecret(server.secret, "recovery-code") }),
        )
        .where("used_at", "is", null)
        .executeTakeFirst();
      if (used.numUpdatedRows === 0n) return false;
      await recordAuditEvent(transaction, { accountId, action: "second-factor.recovery-code-used", now });
      return true;
    });
  if (!passed) return { status: "refused", reason: "wrong" };
  const session = await signIn(server.database, { accountId, token, secondFactor: true, userAgent, now });
  return { status: "signed-in", accountId, token: session.token };
}
