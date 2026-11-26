// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { InboxPanel } from "@sharadox/account-web-library/inbox-panel";
import { renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
afterEach(cleanup);

const first = [
  { id: "3", kind: "new-sign-in", createdAt: "2026-11-25T10:00:00.000Z", readAt: null },
  { id: "2", kind: "contact-added", createdAt: "2026-11-24T10:00:00.000Z", readAt: "2026-11-24T11:00:00.000Z" },
];

test("lists them, marks one or all read, deletes one, and shows more", async () => {
  const actions = {
    loadMore: vi.fn(async () => ({
      notifications: [{ id: "1", kind: "recovery-code-used", createdAt: "2026-11-23T10:00:00.000Z", readAt: null }],
      more: false,
    })),
    markRead: vi.fn(async () => ({ status: "done" as const })),
    remove: vi.fn(async () => ({ status: "done" as const })),
  };
  renderAccountScreen(<InboxPanel locale="en" notifications={first} unread={1} more {...actions} />);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mark as Read" })));
  expect(actions.markRead).toHaveBeenCalledWith(["3"]);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Mark All as Read" })));
  expect(actions.markRead).toHaveBeenLastCalledWith();
  await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]!));
  expect(actions.remove).toHaveBeenCalledWith("2");
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Show More" })));
  // Older than the last one loaded (even if it was just deleted).
  expect(actions.loadMore).toHaveBeenCalledWith("2");
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "Show More" })).toBeNull();
});

test("marking read and deleting show at once, and go back if refused", async () => {
  let finish: (answer: { status: "done" } | { status: "refused"; reason: string }) => void = () => {};
  const pending = () =>
    new Promise<{ status: "done" } | { status: "refused"; reason: string }>((resolve) => (finish = resolve));
  const actions = { loadMore: vi.fn(), markRead: vi.fn(pending), remove: vi.fn(pending) };
  renderAccountScreen(<InboxPanel locale="en" notifications={first} unread={1} more={false} {...actions} />);
  fireEvent.click(screen.getByRole("button", { name: "Mark as Read" }));
  expect(screen.queryByRole("button", { name: "Mark as Read" })).toBeNull();
  await act(async () => finish({ status: "refused", reason: "generic" }));
  expect(screen.getByRole("button", { name: "Mark as Read" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mark All as Read" }));
  expect(screen.queryByRole("button", { name: "Mark as Read" })).toBeNull();
  await act(async () => finish({ status: "refused", reason: "generic" }));
  expect(screen.getByRole("button", { name: "Mark All as Read" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Mark All as Read" }));
  await act(async () => finish({ status: "done" }));
  expect(screen.queryByRole("button", { name: "Mark All as Read" })).toBeNull();
  fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]!);
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  await act(async () => finish({ status: "refused", reason: "generic" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});

test("an empty inbox says so", () => {
  renderAccountScreen(
    <InboxPanel
      locale="en"
      notifications={[]}
      unread={0}
      more={false}
      loadMore={vi.fn()}
      markRead={vi.fn()}
      remove={vi.fn()}
    />,
  );
  expect(screen.getByText("Nothing new.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Mark All as Read" })).toBeNull();
});
