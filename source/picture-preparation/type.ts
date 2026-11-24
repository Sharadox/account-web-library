/** A picture ready to store (always WebP), or why the file was refused. */
export type PreparedPicture =
  | { valid: true; bytes: Uint8Array; width: number; height: number }
  | {
      valid: false;
      /**
       * - `size`: over 5 MB;
       * - `type`: not a JPEG, PNG, GIF, WebP, AVIF or SVG, or broken;
       * - `dimensions`: wider or taller than 4096 pixels;
       * - `suspicious`: far more bytes than its picture needs (something else is hidden in it);
       * - `unsafe`: an SVG that loads something from outside itself or declares entities.
       */
      reason: "size" | "type" | "dimensions" | "suspicious" | "unsafe";
    };
