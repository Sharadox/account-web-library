import { expect, test } from "vitest";
import { databaseError } from "@sharadox/account-web-library/database-error";

test("reads Postgres's error code and constraint", () => {
  expect(databaseError(Object.assign(new Error("x"), { code: "23505", constraint: "a_key" }))).toEqual({
    code: "23505",
    constraint: "a_key",
  });
  expect(databaseError(Object.assign(new Error("x"), { code: "23514" }))).toEqual({
    code: "23514",
    constraint: undefined,
  });
});

test("is undefined for anything else", () => {
  expect(databaseError(new Error("x"))).toBeUndefined();
  expect(databaseError("text")).toBeUndefined();
  expect(databaseError(null)).toBeUndefined();
});
