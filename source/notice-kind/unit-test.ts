import { expect, test } from "vitest";
import { NOTICE_KINDS, noticeChannelLocked, noticeDefault } from "@sharadox/account-web-library/notice-kind";

test("every notice kind goes to the inbox and by email unless its owner chooses otherwise", () => {
  expect(Object.keys(NOTICE_KINDS)).toEqual([
    "new-sign-in",
    "contact-added",
    "recovery-code-used",
    "inactivity-warning",
  ]);
  for (const kind of Object.keys(NOTICE_KINDS) as (keyof typeof NOTICE_KINDS)[]) {
    expect(noticeDefault(kind, "in-app")).toBe(true);
    expect(noticeDefault(kind, "email")).toBe(true);
  }
});

test("security notices keep a channel; the deletion warning always goes by email", () => {
  expect(NOTICE_KINDS["new-sign-in"].security).toBe(true);
  expect(NOTICE_KINDS["inactivity-warning"].security).toBe(false);
  expect(noticeChannelLocked("inactivity-warning", "email")).toBe(true);
  expect(noticeChannelLocked("inactivity-warning", "in-app")).toBe(false);
  expect(noticeChannelLocked("new-sign-in", "email")).toBe(false);
});
