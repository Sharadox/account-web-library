// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { NotificationBell, noticeText, noticeTime } from "@sharadox/account-web-library/notification-bell";
import type { BellPage } from "@sharadox/account-web-library/notification-bell/type";

afterEach(cleanup);

const page = (): BellPage => ({
  unread: 2,
  notifications: [
    { id: "1", kind: "new-sign-in", createdAt: "2026-11-25T10:00:00.000Z", readAt: null },
    { id: "2", kind: "contact-added", createdAt: "2026-11-24T10:00:00.000Z", readAt: null },
    { id: "3", kind: "recovery-code-used", createdAt: "2026-11-23T10:00:00.000Z", readAt: "2026-11-23T11:00:00.000Z" },
  ],
});

const setUp = (load = vi.fn(async () => page())) => {
  const markRead = vi.fn(async () => {});
  const remove = vi.fn(async () => {});
  const view = render(
    <div>
      <NotificationBell
        locale="en"
        unread={2}
        load={load}
        markRead={markRead}
        remove={remove}
        inboxHref="/en/notifications/inbox"
      />
      <p>Outside</p>
    </div>,
  );
  return { load, markRead, remove, view };
};

test("a badge with the unread count; opening loads the latest behind a skeleton", async () => {
  let finish: (value: BellPage) => void = () => {};
  setUp(vi.fn(() => new Promise<BellPage>((resolve) => (finish = resolve))));
  const bell = screen.getByRole("button", { name: "Notifications, 2 unread" });
  fireEvent.click(bell);
  expect(screen.getByRole("status", { name: "Loading…" })).toBeTruthy();
  await act(async () => finish(page()));
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  expect(screen.getByText("New sign-in on a browser not used before")).toBeTruthy();
  expect(screen.getByRole("link", { name: "See all notifications" }).getAttribute("href")).toBe(
    "/en/notifications/inbox",
  );
});

test("marks one or all as read and deletes one, updating the badge", async () => {
  const { markRead, remove } = setUp();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /Notifications/ })));
  await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Mark as read" })[0]!));
  expect(markRead).toHaveBeenCalledWith(["1"]);
  expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy();
  await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]!));
  expect(remove).toHaveBeenCalledWith("2");
  expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
  await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]!));
  expect(remove).toHaveBeenLastCalledWith("3");
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
});

test("Mark all as read, then the empty inbox; Escape and a click outside close it", async () => {
  const { markRead } = setUp(vi.fn(async () => page()));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /Notifications/ })));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mark all as read" })));
  expect(markRead).toHaveBeenCalledWith(undefined);
  expect(screen.queryByRole("button", { name: "Mark as read" })).toBeNull();
  fireEvent.keyDown(document, { key: "a" });
  fireEvent.pointerDown(screen.getByText("Notifications", { selector: "p" }));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("list")).toBeNull();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /Notifications/ })));
  fireEvent.pointerDown(screen.getByText("Outside"));
  expect(screen.queryByRole("list")).toBeNull();
  cleanup();
  setUp(vi.fn(async () => ({ unread: 0, notifications: [] })));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /Notifications/ })));
  expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
  expect(screen.getByText("Nothing new.")).toBeTruthy();
  fireEvent.click(screen.getByRole("link", { name: "See all notifications" }));
  expect(screen.queryByText("Nothing new.")).toBeNull();
});

test("a closed bell ignores a load that comes late; counts over 99 are shortened", async () => {
  let finish: (value: BellPage) => void = () => {};
  const load = vi.fn(() => new Promise<BellPage>((resolve) => (finish = resolve)));
  const { view } = setUp(load);
  fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
  fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
  await act(async () => finish({ unread: 120, notifications: [] }));
  expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toBeTruthy();
  view.rerender(
    <NotificationBell locale="pt" unread={120} load={load} markRead={vi.fn()} remove={vi.fn()} inboxHref="/pt" />,
  );
  expect(screen.getByText("99+")).toBeTruthy();
  expect(noticeText("made-up", "en")).toBe("made-up");
  expect(noticeTime("2026-11-25T10:00:00.000Z", "pt")).toContain("2026");
});
