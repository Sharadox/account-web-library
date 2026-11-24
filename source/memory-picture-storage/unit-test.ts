import { expect, test } from "vitest";
import { createMemoryPictureStorage } from "@sharadox/account-web-library/memory-picture-storage";

test("keeps files in memory, replaces and removes them, and ignores missing ones", async () => {
  const storage = createMemoryPictureStorage();
  await storage.put("a", new Uint8Array([1]), "image/webp");
  await storage.put("a", new Uint8Array([2]), "image/webp");
  expect(storage.files.get("a")).toEqual({ bytes: new Uint8Array([2]), contentType: "image/webp" });
  await storage.remove("a");
  await storage.remove("missing");
  expect(storage.files.size).toBe(0);
});
