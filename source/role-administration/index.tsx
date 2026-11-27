"use client";
import { useState } from "react";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { Button } from "@sharadox/interface-web-library/button";
import { Card } from "@sharadox/interface-web-library/card";
import { ACCOUNT_WORDS, say } from "@sharadox/account-web-library/account-words";
import { Dialog } from "@sharadox/interface-web-library/dialog";
import { PendingRows } from "@sharadox/account-web-library/pending-rows";
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
  if (!roles)
    return (
      <Card>
        <PendingRows
          locale={locale}
          rows={3}
          values={["12ch", "10ch"]}
          className={styles.list}
          rowClassName={styles.row}
        />
      </Card>
    );
  const applications = [...new Set(roles.map(({ application }) => application))];
  return (
    <>
      {applications.map((application) => (
        <Card key={application} title={application}>
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
                    <Button look="plain" icon="trash" onClick={() => setAsking(role)}>
                      {say(words.deleteRole, locale)}
                    </Button>
                  )}
                </li>
              ))}
          </ul>
        </Card>
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
          <Button
            look="danger"
            pending={pending}
            onClick={async () => {
              const role = asking!;
              await run(() => remove(role.application, role.key), { success: say(ACCOUNT_WORDS.common.done, locale) });
              setAsking(null);
            }}
          >
            {say(ACCOUNT_WORDS.common.delete, locale)}
          </Button>
          <Button look="quiet" onClick={() => setAsking(null)}>
            {say(ACCOUNT_WORDS.common.cancel, locale)}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
