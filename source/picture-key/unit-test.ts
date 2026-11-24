import { expect, test } from "vitest";
import { pictureKey } from "@sharadox/account-web-library/picture-key";

test("names the file after the picture's id", () => {
  expect(pictureKey("0198f5a2-7a4c-7000-8000-00000000000a")).toBe(
    "account-picture/0198f5a2-7a4c-7000-8000-00000000000a.webp",
  );
});
