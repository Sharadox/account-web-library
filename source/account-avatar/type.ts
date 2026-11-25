export interface AccountAvatarProperties {
  name: string;
  /** The account's picture (the account site's `/picture/<id>.webp`), or null for initials. */
  pictureUrl: string | null;
  /** Its width and height in pixels (36 by default). */
  size?: number;
  className?: string;
}
