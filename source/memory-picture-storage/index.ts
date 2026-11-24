import type { PictureStorage } from "@sharadox/account-web-library/picture-storage/type";

/**
 * Picture storage in memory, for tests and local runs: `files` shows what is stored.
 *
 * @example
 * const storage = createMemoryPictureStorage();
 * await setAccountPicture(database, storage, { accountId, bytes });
 */
export function createMemoryPictureStorage(): PictureStorage & {
  files: Map<string, { bytes: Uint8Array; contentType: string }>;
} {
  const files = new Map<string, { bytes: Uint8Array; contentType: string }>();
  return {
    files,
    put: async (key, bytes, contentType) => void files.set(key, { bytes, contentType }),
    remove: async (key) => void files.delete(key),
  };
}
