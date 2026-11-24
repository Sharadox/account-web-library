import type { PreparedPicture } from "@sharadox/account-web-library/picture-preparation/type";

export type AccountPictureChangeResult =
  | { changed: true; pictureId: string }
  | { changed: false; reason: Extract<PreparedPicture, { valid: false }>["reason"] | "no-account" };
