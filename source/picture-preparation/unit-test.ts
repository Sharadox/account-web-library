import sharp from "sharp";
import { expect, test } from "vitest";
import { PICTURE_MAXIMUM_BYTES, preparePicture } from "@sharadox/account-web-library/picture-preparation";

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } } });

const isWebp = (bytes: Uint8Array) =>
  Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP";

test("turns JPEG, PNG, WebP and AVIF into WebP, at most 1024 pixels on the longer side", async () => {
  for (const format of ["jpeg", "png", "webp", "avif"] as const) {
    const input = await solid(2000, 1000).toFormat(format).toBuffer();
    const result = await preparePicture(new Uint8Array(input));
    if (!result.valid) throw new Error(`${format}: ${result.reason}`);
    expect(isWebp(result.bytes)).toBe(true);
    expect([result.width, result.height]).toEqual([1024, 512]);
  }
  const small = await preparePicture(new Uint8Array(await solid(64, 48).png().toBuffer()));
  expect(small).toMatchObject({ valid: true, width: 64, height: 48 });
});

test("drops metadata such as a photo's location, and applies its rotation", async () => {
  const input = await solid(40, 20)
    .jpeg()
    .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: "secret place" } } })
    .toBuffer();
  const result = await preparePicture(new Uint8Array(input));
  if (!result.valid) throw new Error(result.reason);
  expect([result.width, result.height]).toEqual([20, 40]);
  const metadata = await sharp(result.bytes).metadata();
  expect(metadata.exif).toBeUndefined();
  expect(Buffer.from(result.bytes).includes("secret place")).toBe(false);
});

test("keeps a GIF's animation", async () => {
  const frame = (background: string) =>
    sharp({ create: { width: 10, height: 20, channels: 4, background } })
      .png()
      .toBuffer();
  const animated = await sharp([await frame("#ff0000"), await frame("#00ff00")], { join: { animated: true } })
    .gif()
    .toBuffer();
  const result = await preparePicture(new Uint8Array(animated));
  if (!result.valid) throw new Error(result.reason);
  expect(await sharp(result.bytes).metadata()).toMatchObject({ pages: 2, width: 10 });
  expect([result.width, result.height]).toEqual([10, 20]);
});

test("draws an SVG as an image, so nothing in it can ever run", async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12"><script>alert(1)</script>
    <rect width="24" height="12" fill="red" onclick="alert(2)"/></svg>`;
  const result = await preparePicture(new TextEncoder().encode(svg));
  if (!result.valid) throw new Error(result.reason);
  expect(isWebp(result.bytes)).toBe(true);
  expect([result.width, result.height]).toEqual([1024, 512]);
});

test("refuses an SVG that reaches outside itself or declares entities", async () => {
  for (const svg of [
    `<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><image href="file:///etc/passwd"/></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://x.example/a.svg#b"/></svg>`,
    `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aaaa">]><svg xmlns="http://www.w3.org/2000/svg">&a;</svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://x.example/a.css);</style></svg>`,
  ])
    expect(await preparePicture(new TextEncoder().encode(svg))).toEqual({ valid: false, reason: "unsafe" });
  const local = `<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><defs><rect id="r" width="4" height="4"/></defs><use href="#r"/></svg>`;
  expect((await preparePicture(new TextEncoder().encode(local))).valid).toBe(true);
});

test("refuses files that are too big, too large in pixels, not images, or far bigger than their picture", async () => {
  expect(await preparePicture(new Uint8Array(PICTURE_MAXIMUM_BYTES + 1))).toEqual({ valid: false, reason: "size" });
  expect(await preparePicture(new TextEncoder().encode("just some text"))).toEqual({ valid: false, reason: "type" });
  const huge = await sharp({ create: { width: 5000, height: 10, channels: 3, background: "#000" } })
    .png()
    .toBuffer();
  expect(await preparePicture(new Uint8Array(huge))).toEqual({ valid: false, reason: "dimensions" });
  const tiny = await solid(4, 4).png().toBuffer();
  const padded = Buffer.concat([tiny, Buffer.alloc(200_000, 7)]);
  expect(await preparePicture(new Uint8Array(padded))).toEqual({ valid: false, reason: "suspicious" });
  const broken = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(30)]);
  expect(await preparePicture(new Uint8Array(broken))).toEqual({ valid: false, reason: "type" });
});

test("refuses a picture whose header reads well but whose data is cut short", async () => {
  const whole = await sharp({
    create: {
      width: 300,
      height: 300,
      channels: 3,
      background: "#000000",
      noise: { type: "gaussian", mean: 128, sigma: 60 },
    },
  })
    .png()
    .toBuffer();
  expect(await preparePicture(new Uint8Array(whole.subarray(0, Math.floor(whole.length / 2))))).toEqual({
    valid: false,
    reason: "type",
  });
});
