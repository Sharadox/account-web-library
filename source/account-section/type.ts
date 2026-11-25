import type { ReactNode } from "react";

export interface AccountSectionProperties {
  /** Where jumps to it land (`#devices`): the section's key. */
  id: string;
  /** Its name, the heading. */
  title: string;
  /** A line under the heading. */
  description?: ReactNode;
  /** Named, but without a visible heading (the only section on its page). */
  hideTitle?: boolean;
  children: ReactNode;
}
