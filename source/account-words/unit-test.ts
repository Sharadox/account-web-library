import { expect, test } from "vitest";
import { ACCOUNT_WORDS, explainRefusal, say } from "@sharadox/account-web-library/account-words";

test("every phrase is in both languages, never empty", () => {
  const walk = (node: object): void => {
    for (const value of Object.values(node)) {
      if ("en" in value && "pt" in value) {
        expect(value.en.length).toBeGreaterThan(0);
        expect(value.pt.length).toBeGreaterThan(0);
      } else walk(value);
    }
  };
  walk(ACCOUNT_WORDS);
  expect(say(ACCOUNT_WORDS.common.save, "pt")).toBe("Guardar");
});

test("explains refusals, waits and anything unknown", () => {
  expect(explainRefusal({ reason: "identifier-taken" }, "en")).toBe("That identifier is taken. Try another.");
  expect(explainRefusal({ reason: "rate-limit", retryAfterSeconds: 30 }, "en")).toBe("Too many tries. Wait 1 minute.");
  expect(explainRefusal({ reason: "rate-limit", retryAfterSeconds: 150 }, "pt")).toBe(
    "Demasiadas tentativas. Aguarde 3 minutos.",
  );
  expect(explainRefusal({ reason: "rate-limit" }, "en")).toBe("Too many tries. Wait 1 minute.");
  expect(explainRefusal({ reason: "who-knows" }, "en")).toBe("Something went wrong. Please try again.");
});
