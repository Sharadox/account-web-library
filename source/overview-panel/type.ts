import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface OverviewPanelProperties {
  locale: AccountLocale;
  /** Who it is; while on its way, the picture, name and identifier show as skeletons. */
  who?: {
    name: string;
    /** Without the `@`. */
    identifier: string;
    pictureUrl: string | null;
  };
  /** The numbers; while on their way, each shows as a skeleton (the cards and their words show at once). */
  counts?: {
    /** How many ways in, and how many of them are required. */
    methods: number;
    required: number;
    devices: number;
    unread: number;
  };
}
