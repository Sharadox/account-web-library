import sharp from "sharp";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { MemoryDatabase } from "@sharadox/database-web-library/memory-database/type";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { removeAccountPicture, setAccountPicture } from "@sharadox/account-web-library/account-picture-change";
import { createMemoryPictureStorage } from "@sharadox/account-web-library/memory-picture-storage";
import { pictureKey } from "@sharadox/account-web-library/picture-key";
import { createTestAccountDatabase } from "@sharadox/account-web-library/test-database";
import { createTestPerson } from "@sharadox/account-web-library/test-person";

let memory: MemoryDatabase<AccountDatabase>;
beforeEach(async () => (memory = await createTestAccountDatabase()));
afterEach(() => memory.close());

const png = async (width = 30, height = 20) =>
  new Uint8Array(
    await sharp({ create: { width, height, channels: 3, background: "#123456" } })
      .png()
      .toBuffer(),
  );

test("stores the prepared picture, and deletes the old file when it is replaced", async () => {
  const storage = createMemoryPictureStorage();
  const { accountId } = await createTestPerson(memory.database, "ana");
  const first = await setAccountPicture(memory.database, storage, { accountId, bytes: await png() });
  if (!first.changed) throw new Error(first.reason);
  expect([...storage.files.keys()]).toEqual([pictureKey(first.pictureId)]);
  expect(storage.files.get(pictureKey(first.pictureId))!.contentType).toBe("image/webp");
  expect(await memory.database.selectFrom("account_picture").selectAll().execute()).toEqual([
    {
      id: first.pictureId,
      account_id: accountId,
      content_type: "image/webp",
      byte_size: storage.files.get(pictureKey(first.pictureId))!.bytes.length,
      width: 30,
      height: 20,
      created_at: expect.any(Date),
    },
  ]);
  const second = await setAccountPicture(memory.database, storage, { accountId, bytes: await png(8, 8) });
  if (!second.changed) throw new Error(second.reason);
  expect([...storage.files.keys()]).toEqual([pictureKey(second.pictureId)]);
  expect(await memory.database.selectFrom("account_picture").select("id").execute()).toEqual([
    { id: second.pictureId },
  ]);
  const actions = await memory.database.selectFrom("audit_event").select("action").execute();
  expect(actions.filter(({ action }) => action === "account.picture-changed")).toHaveLength(2);
});

test("refuses what preparePicture refuses, and unknown accounts, storing nothing", async () => {
  const storage = createMemoryPictureStorage();
  const { accountId } = await createTestPerson(memory.database, "ana");
  expect(
    await setAccountPicture(memory.database, storage, { accountId, bytes: new TextEncoder().encode("text") }),
  ).toEqual({ changed: false, reason: "type" });
  expect(
    await setAccountPicture(memory.database, storage, {
      accountId: "0198f5a2-7a4c-7000-8000-000000000009",
      bytes: await png(),
    }),
  ).toEqual({ changed: false, reason: "no-account" });
  expect(storage.files.size).toBe(0);
});

test("removes the picture and its file", async () => {
  const storage = createMemoryPictureStorage();
  const { accountId } = await createTestPerson(memory.database, "ana");
  await setAccountPicture(memory.database, storage, { accountId, bytes: await png() });
  expect(await removeAccountPicture(memory.database, storage, { accountId })).toEqual({ removed: true });
  expect(storage.files.size).toBe(0);
  expect(await memory.database.selectFrom("account_picture").select("id").execute()).toEqual([]);
  expect(await removeAccountPicture(memory.database, storage, { accountId })).toEqual({ removed: false });
});
