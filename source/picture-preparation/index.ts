import sharp from "sharp";
import type { PreparedPicture } from "@sharadox/account-web-library/picture-preparation/type";

/** The largest file accepted: 5 MB. */
export const PICTURE_MAXIMUM_BYTES = 5 * 1024 * 1024;
/** The widest and tallest picture accepted, in pixels. */
export const PICTURE_MAXIMUM_DIMENSION = 4096;
/** Stored pictures are at most this many pixels on their longer side. */
const STORED_DIMENSION = 1024;
/** Slack for headers, color profiles and palettes when judging whether a file is bigger than its picture. */
const OVERHEAD_BYTES = 64 * 1024;

const startsWith = (bytes: Uint8Array, text: string, offset = 0) =>
  Buffer.from(bytes.subarray(offset, offset + text.length)).toString("latin1") === text;

function kind(bytes: Uint8Array): "raster" | "svg" | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "raster";
  if (startsWith(bytes, "\x89PNG\r\n\x1a\n") || startsWith(bytes, "GIF8")) return "raster";
  if (startsWith(bytes, "RIFF") && startsWith(bytes, "WEBP", 8)) return "raster";
  if (startsWith(bytes, "ftypavi", 4)) return "raster";
  const text = new TextDecoder()
    .decode(bytes.subarray(0, 1024))
    .replace(/^\uFEFF/u, "")
    .trimStart();
  if ((text.startsWith("<?xml") || text.startsWith("<svg")) && text.includes("<svg")) return "svg";
  return undefined;
}

/** References an SVG may make: only to itself (`#id`) or to pictures inside it (`data:image/…`). */
function unsafeSvg(text: string): boolean {
  if (/<!(DOCTYPE|ENTITY)/i.test(text)) return true;
  if (/@import|url\(\s*['"]?(?!#|data:image\/)/i.test(text)) return true;
  for (const [, value] of text.matchAll(/(?:href|src)\s*=\s*["']([^"']*)["']/gi))
    if (!value!.startsWith("#") && !/^data:image\/(png|jpeg|gif|webp);/i.test(value!)) return true;
  return false;
}

/**
 * Checks an uploaded picture and makes the file to store: always WebP, at most 1024 pixels on its longer side,
 * rotated as the photo says, with every piece of metadata (a photo's location, camera, comments) dropped. A GIF
 * keeps its animation. An SVG is drawn into an image, so no script or link in it can ever run. Refuses files over
 * 5 MB or 4096 pixels, files far bigger than their picture needs (something else is hidden in them), and SVGs that
 * load anything from outside themselves.
 *
 * @example
 * const picture = await preparePicture(new Uint8Array(await file.arrayBuffer()));
 * if (!picture.valid) return explain(picture.reason);
 */
export async function preparePicture(bytes: Uint8Array): Promise<PreparedPicture> {
  if (bytes.length > PICTURE_MAXIMUM_BYTES) return { valid: false, reason: "size" };
  const type = kind(bytes);
  if (!type) return { valid: false, reason: "type" };
  if (type === "svg" && unsafeSvg(new TextDecoder().decode(bytes))) return { valid: false, reason: "unsafe" };
  const options = { animated: true, limitInputPixels: PICTURE_MAXIMUM_DIMENSION ** 2 * 4 } as const;
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(bytes, options).metadata();
  } catch {
    return { valid: false, reason: "type" };
  }
  const width = metadata.width;
  const height = metadata.pageHeight ?? metadata.height;
  if (width > PICTURE_MAXIMUM_DIMENSION || height > PICTURE_MAXIMUM_DIMENSION)
    return { valid: false, reason: "dimensions" };
  if (type === "raster" && bytes.length > width * height * (metadata.pages ?? 1) * 4 + OVERHEAD_BYTES)
    return { valid: false, reason: "suspicious" };
  // An SVG is drawn large enough for its longer side to fill the stored size, however small it says it is.
  const density = type === "svg" ? Math.min(2400, (72 * STORED_DIMENSION) / Math.max(width, height)) : undefined;
  try {
    const { data, info } = await sharp(bytes, { ...options, ...(density ? { density } : {}) })
      .rotate()
      .resize({ width: STORED_DIMENSION, height: STORED_DIMENSION, fit: "inside", withoutEnlargement: !density })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
    return { valid: true, bytes: new Uint8Array(data), width: info.width, height: info.pageHeight ?? info.height };
  } catch {
    return { valid: false, reason: "type" };
  }
}
