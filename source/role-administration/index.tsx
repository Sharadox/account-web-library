"use client";
import { useState } from "react";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { AccountButton } from "@sharadox/account-web-library/account-button";
import { AccountCard } from "@sharadox/account-web-library/account-card";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { Dialog } from "@sharadox/account-web-library/dialog";
import styles from "./index.module.scss";
import type { RoleAdministrationProperties, RoleRow } from "@sharadox/account-web-library/role-administration/type";

/**
 * Every role per application with how many hold it; deleting one (not the default or a ban role) first says how many
 * accounts will lose it, in a pop-up.
 *
 * @example
 * <RoleAdministration locale="en" roles={roles} remove={deleteRole} />
 */
export function RoleAdministration({ locale, roles, remove }: RoleAdministrationProperties) {
  const [asking, setAsking] = useState<RoleRow | null>(null);
  const { run, pending } = useAccountAction();
  const words = ACCOUNT_WORDS.administration;
  const applications = [...new Set(roles.map(({ application }) => application))];
  return (
    <>
      {applications.map((application) => (
        <AccountCard key={application} title={application}>
          <ul className={styles.list}>
            {roles
              .filter((role) => role.application === application)
              .map((role) => (
                <li key={role.key} className={styles.row}>
                  <span>
                    <strong>{role.name}</strong>{" "}
                    <span className={styles.muted}>
                      {say(words.holdersOf, locale)} {role.holders} {say(words.holders, locale)}
                    </span>
                  </span>
                  {!role.protected && (
                    <AccountButton look="plain" icon="trash" onClick={() => setAsking(role)}>
                      {say(words.deleteRole, locale)}
                    </AccountButton>
                  )}
                </li>
              ))}
          </ul>
        </AccountCard>
      ))}
      <Dialog
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={say(words.deleteRoleTitle, locale)}
        closeLabel={say(ACCOUNT_WORDS.common.close, locale)}
      >
        <p className={styles.text}>
          {say(words.deleteRoleConfirm, locale)} <strong>{asking?.holders}</strong> {say(words.holders, locale)}.
        </p>
        <div className={styles.buttons}>
          <AccountButton
            look="danger"
            pending={pending}
            onClick={async () => {
              const role = asking!;
              await run(() => remove(role.application, role.key), { success: say(ACCOUNT_WORDS.common.done, locale) });
              setAsking(null);
            }}
          >
            {say(ACCOUNT_WORDS.common.delete, locale)}
          </AccountButton>
          <AccountButton look="quiet" onClick={() => setAsking(null)}>
            {say(ACCOUNT_WORDS.common.cancel, locale)}
          </AccountButton>
        </div>
      </Dialog>
    </>
  );
}
