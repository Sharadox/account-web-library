/**
 * Where picture files live (object storage such as S3): the database keeps only each picture's id and size. The
 * application gives an implementation; tests use `createMemoryPictureStorage`.
 */
export interface PictureStorage {
  /** Stores a file under `key`, replacing any file there. */
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** Deletes the file under `key`; a missing file is not an error. */
  remove(key: string): Promise<void>;
}
