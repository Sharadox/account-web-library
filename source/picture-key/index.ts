/**
 * The storage key of an account picture's file: `account-picture/<id>.webp` (every picture is stored as WebP).
 *
 * @example
 * pictureKey("0198f5a2-…"); // "account-picture/0198f5a2-….webp"
 */
export function pictureKey(pictureId: string): string {
  return `account-picture/${pictureId}.webp`;
}
