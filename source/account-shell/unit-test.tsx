// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { accountAreas } from "@sharadox/account-web-library/account-area";
import { AccountSection } from "@sharadox/account-web-library/account-section";
import { AccountShell } from "@sharadox/account-web-library/account-shell";

let path = "/en/security";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

/** The sections the observer was told to watch, and a way to say one came into view. */
let watched: Element[] = [];
let callbacks: ((entries: Partial<IntersectionObserverEntry>[]) => void)[] = [];
const seen = (entries: Partial<IntersectionObserverEntry>[]) => callbacks.forEach((callback) => callback(entries));
beforeEach(() => {
  watched = [];
  callbacks = [];
  globalThis.IntersectionObserver = class {
    constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
      callbacks.push(callback);
    }
    observe(element: Element) {
      watched.push(element);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
});
afterEach(cleanup);

const security = () => (
  <AccountShell locale="en" areas={accountAreas({ locale: "en", administrator: false })}>
    <AccountSection id="methods" title="Sign-In Methods" description="Every way you can sign in.">
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
  const areas = screen.getByRole("navigation", { name: "Account areas" });
  expect(within(areas).getAllByRole("link")).toHaveLength(5);
  expect(within(areas).getByRole("link", { name: "Security" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Security");
  const sections = screen.getByRole("navigation", { name: "Sections" });
  const devices = within(sections).getByRole("link", { name: "Devices" });
  expect(devices.getAttribute("href")).toBe("/en/security#devices");
  expect(within(sections).getByRole("link", { name: "Sign-In Methods" }).getAttribute("aria-current")).toBe("true");
  expect(screen.getByRole("region", { name: "Devices" }).textContent).toContain("Devices list");
  expect(screen.getByText("Every way you can sign in.")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 1 }).closest("[data-sections]")).toBeTruthy();
  expect(watched.map(({ id }) => id).filter(Boolean)).toEqual(["methods", "devices", "activity"]);
});

test("a jump scrolls to its section and marks it; reading further down moves the mark", () => {
  path = "/en/security";
  render(security());
  const scrolled = vi.fn();
  const target = document.getElementById("activity")!;
  target.scrollIntoView = scrolled;
  const sections = screen.getByRole("navigation", { name: "Sections" });
  fireEvent.click(within(sections).getByRole("link", { name: "Activity" }));
  expect(scrolled).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  expect(window.location.hash).toBe("#activity");
  expect(within(sections).getByRole("link", { name: "Activity" }).getAttribute("aria-current")).toBe("true");
  act(() => seen([{ isIntersecting: true, target: document.getElementById("devices")! }, { isIntersecting: false }]));
  expect(within(sections).getByRole("link", { name: "Devices" }).getAttribute("aria-current")).toBe("true");
  act(() => seen([{ isIntersecting: false, target: document.getElementById("methods")! }]));
  expect(within(sections).getByRole("link", { name: "Devices" }).getAttribute("aria-current")).toBe("true");
  // A click that opens a new tab is left to the browser.
  fireEvent.click(within(sections).getByRole("link", { name: "Activity" }), { metaKey: true });
  expect(scrolled).toHaveBeenCalledOnce();
});

test("after a jump, the section stays in place while what is above it fills in, until the reader scrolls", () => {
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
  const scrolled = vi.fn();
  document.getElementById("activity")!.scrollIntoView = scrolled;
  fireEvent.click(within(screen.getByRole("navigation", { name: "Sections" })).getByRole("link", { name: "Activity" }));
  act(() => resized());
  expect(scrolled).toHaveBeenLastCalledWith({ block: "start" });
  expect(scrolled).toHaveBeenCalledTimes(2);
  fireEvent.wheel(window);
  act(() => resized());
  expect(scrolled).toHaveBeenCalledTimes(2);
});

test("a held jump lets go by itself after a while", () => {
  vi.useFakeTimers();
  try {
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
    const scrolled = vi.fn();
    document.getElementById("devices")!.scrollIntoView = scrolled;
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Sections" })).getByRole("link", { name: "Devices" }),
    );
    act(() => vi.advanceTimersByTime(3_000));
    act(() => resized());
    expect(scrolled).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
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
