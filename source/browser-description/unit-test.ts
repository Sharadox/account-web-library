import { expect, test } from "vitest";
import { describeBrowser } from "@sharadox/account-web-library/browser-description";

test("names the browser and the system from a User-Agent", () => {
  const cases: [string, string | undefined][] = [
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
      "Safari on macOS",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0",
      "Edge on Windows",
    ],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0", "Firefox on Linux"],
    [
      "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36",
      "Chrome on Android",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
      "Safari on iPhone",
    ],
    [
      "Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1",
      "Chrome on iPad",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 OPR/115.0",
      "Opera on Windows",
    ],
    [
      "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
      "Chrome on ChromeOS",
    ],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:133.0) Gecko/20100101 Firefox/133.0", "Firefox on macOS"],
    ["curl/8.5.0", undefined],
    ["", undefined],
  ];
  for (const [agent, expected] of cases) expect(describeBrowser(agent)).toBe(expected);
  expect(describeBrowser(null)).toBeUndefined();
  expect(describeBrowser("Mozilla/5.0 (X11; Linux x86_64) Firefox/133.0", "em")).toBe("Firefox em Linux");
  expect(describeBrowser("Mozilla/5.0 (SomethingOS) Firefox/1")).toBe("Firefox");
  expect(describeBrowser("Mozilla/5.0 (Windows NT 10.0) Strange/1")).toBe("Windows");
});
