/** Browsers in the order to test them: Edge, Opera and Chrome on iOS all say "Chrome" or "Safari" too. */
const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Version\/[\d.]+.*Safari\//, "Safari"],
];
const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"],
];

/**
 * A short, readable name for the device behind a User-Agent (`Firefox on macOS`), for the list of devices (`on` is the word joining the two, in the visitor's language); undefined
 * when it says nothing recognizable.
 *
 * @example
 * describeBrowser(request.headers.get("user-agent")); // "Safari on iPhone"
 * describeBrowser(agent, "em"); // "Safari em iPhone"
 */
export function describeBrowser(userAgent: string | null, on = "on"): string | undefined {
  if (!userAgent) return undefined;
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (browser && system) return `${browser} ${on} ${system}`;
  return browser ?? system;
}
