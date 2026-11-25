import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface OverviewPanelProperties {
  locale: AccountLocale;
  name: string;
  /** Without the `@`. */
  identifier: string;
  pictureUrl: string | null;
  /** How many ways in, and how many of them are required. */
  methods: number;
  required: number;
  devices: number;
  unread: number;
}
