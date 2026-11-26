// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { accountAreas } from "@sharadox/account-web-library/account-area";
import { AccountSection } from "@sharadox/account-web-library/account-section";
import { AccountShell } from "@sharadox/account-web-library/account-shell";

let path = "/en/security";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

const glideTo = vi.fn();
vi.mock("@sharadox/scroll-web-library/glide", () => ({ glideTo: (top: number) => glideTo(top) }));

/** Puts each section's top at `tops[id]` pixels from the top of the screen. */
const place = (tops: Record<string, number>) => {
  for (const [id, top] of Object.entries(tops))
    document.getElementById(id)!.getBoundingClientRect = () => ({ top }) as DOMRect;
};
/** Scrolls the page to `y` and lets the next frame run. */
const scroll = (y: number) =>
  act(() => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    fireEvent.scroll(window);
    vi.advanceTimersToNextFrame();
  });
beforeEach(() => {
  glideTo.mockClear();
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout"] });
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  Object.defineProperty(document.documentElement, "scrollHeight", { value: 10_000, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const security = () => (
  <AccountShell locale="en" areas={accountAreas({ locale: "en", administrator: false })}>
    <AccountSection id="methods" title="Authentication Methods" description="Every way you can sign in.">
      <p>Methods</p>
    </AccountSection>
    <AccountSection id="devices" title="Devices">
      <p>Devices list</p>
    </AccountSection>
    <AccountSection id="activity" title="Activity">
      <p>Activity list</p>
    </AccountSection>
  </AccountShell>
);

test("the areas across the top, the area's heading, and its sections to jump to", () => {
  path = "/en/security";
  render(security());
  const areas = screen.getByRole("navigation", { name: "Account Areas" });
  expect(within(areas).getAllByRole("link")).toHaveLength(5);
  expect(within(areas).getByRole("link", { name: "Security" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Security");
  const sections = screen.getByRole("navigation", { name: "Sections" });
  const devices = within(sections).getByRole("link", { name: "Devices" });
  expect(devices.getAttribute("href")).toBe("/en/security#devices");
  expect(within(sections).getByRole("link", { name: "Authentication Methods" }).getAttribute("aria-current")).toBe(
    "true",
  );
  expect(screen.getByRole("region", { name: "Devices" }).textContent).toContain("Devices list");
  expect(screen.getByText("Every way you can sign in.")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 1 }).closest("[data-sections]")).toBeTruthy();
});

test("a jump glides to its section (under the bar) and marks it; reading further down moves the mark", () => {
  path = "/en/security";
  render(security());
  const sections = screen.getByRole("navigation", { name: "Sections" });
  place({ methods: 100, devices: 900, activity: 1_600 });
  fireEvent.click(within(sections).getByRole("link", { name: "Activity" }));
  expect(glideTo).toHaveBeenCalledWith(1_600);
  expect(window.location.hash).toBe("#activity");
  expect(within(sections).getByRole("link", { name: "Activity" }).getAttribute("aria-current")).toBe("true");
  // While the jump holds, scrolling doesn't move the mark; once the reader scrolls themselves, it follows.
  scroll(10);
  expect(within(sections).getByRole("link", { name: "Activity" }).getAttribute("aria-current")).toBe("true");
  fireEvent.wheel(window);
  place({ methods: -800, devices: 100, activity: 700 });
  scroll(900);
  expect(within(sections).getByRole("link", { name: "Devices" }).getAttribute("aria-current")).toBe("true");
  place({ methods: 100, devices: 900, activity: 1_600 });
  scroll(0);
  expect(within(sections).getByRole("link", { name: "Authentication Methods" }).getAttribute("aria-current")).toBe(
    "true",
  );
  // Above the first section, the first is the one read.
  place({ methods: 400, devices: 900, activity: 1_600 });
  scroll(5);
  expect(within(sections).getByRole("link", { name: "Authentication Methods" }).getAttribute("aria-current")).toBe(
    "true",
  );
  // At the very bottom, the last section is the one read, however short.
  Object.defineProperty(document.documentElement, "scrollHeight", { value: 1_000, configurable: true });
  scroll(1_000 - window.innerHeight + 5);
  expect(within(sections).getByRole("link", { name: "Activity" }).getAttribute("aria-current")).toBe("true");
  // A click that opens a new tab is left to the browser.
  fireEvent.click(within(sections).getByRole("link", { name: "Activity" }), { metaKey: true });
  expect(glideTo).toHaveBeenCalledOnce();
  // Many scroll events wait for one frame; with no sections on the page, the mark stays.
  document.getElementById("devices")!.id = "gone";
  document.getElementById("methods")!.id = "gone-too";
  document.getElementById("activity")!.id = "gone-also";
  fireEvent.wheel(window);
  act(() => {
    fireEvent.scroll(window);
    fireEvent.scroll(window);
    vi.advanceTimersToNextFrame();
  });
  expect(within(sections).getByRole("link", { name: "Activity" }).getAttribute("aria-current")).toBe("true");
});

test("after a jump, the glide is aimed again while what is above fills in, until the reader scrolls or time passes", () => {
  path = "/en/security";
  let resized: () => void = () => {};
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      let on = true;
      resized = () => on && callback();
      this.disconnect = () => void (on = false);
    }
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  render(security());
  place({ activity: 1_000 });
  fireEvent.click(within(screen.getByRole("navigation", { name: "Sections" })).getByRole("link", { name: "Activity" }));
  place({ activity: 1_400 });
  act(() => resized());
  expect(glideTo).toHaveBeenLastCalledWith(1_400);
  fireEvent.keyDown(window);
  act(() => resized());
  expect(glideTo).toHaveBeenCalledTimes(2);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Sections" })).getByRole("link", { name: "Activity" }));
  act(() => vi.advanceTimersByTime(3_000));
  act(() => resized());
  expect(glideTo).toHaveBeenCalledTimes(3);
});

test("a jump while the area's page is still on its way: marked and in the address at once, glided to once it shows", () => {
  path = "/en/security";
  let resized: () => void = () => {};
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      resized = callback;
    }
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  render(security());
  document.getElementById("devices")!.id = "not-yet";
  const sections = screen.getByRole("navigation", { name: "Sections" });
  fireEvent.click(within(sections).getByRole("link", { name: "Devices" }));
  expect(window.location.hash).toBe("#devices");
  expect(within(sections).getByRole("link", { name: "Devices" }).getAttribute("aria-current")).toBe("true");
  expect(glideTo).not.toHaveBeenCalled();
  act(() => resized());
  expect(glideTo).not.toHaveBeenCalled();
  document.getElementById("not-yet")!.id = "devices";
  place({ devices: 900 });
  act(() => resized());
  expect(glideTo).toHaveBeenLastCalledWith(900);
  window.location.hash = "";
});

test("an address with a section opens there", () => {
  path = "/en/security";
  window.location.hash = "#devices";
  const scrolled = vi.fn();
  Element.prototype.scrollIntoView = scrolled;
  render(security());
  expect(scrolled).toHaveBeenCalledWith({ block: "start" });
  window.location.hash = "";
});

test("one section needs no side menu; outside the areas nothing is marked", () => {
  path = "/pt";
  const areas = accountAreas({ locale: "pt", administrator: true });
  const { rerender } = render(
    <AccountShell locale="pt" areas={areas}>
      <p>Resumo</p>
    </AccountShell>,
  );
  expect(screen.queryByRole("navigation", { name: "Secções" })).toBeNull();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Resumo");
  // Without a side menu, the page takes the whole width.
  expect(screen.getByRole("heading", { level: 1 }).closest("[data-sections]")).toBeNull();
  path = "/pt/nowhere";
  rerender(
    <AccountShell locale="pt" areas={areas}>
      <p />
    </AccountShell>,
  );
  expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  expect(screen.queryByRole("link", { current: "page" })).toBeNull();
});
