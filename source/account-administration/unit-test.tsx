// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AccountAdministration } from "@sharadox/account-web-library/account-administration";
import { renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
afterEach(cleanup);

const account = {
  account: { accountId: "a1", name: "Ana", identifier: "ana", pictureUrl: null },
  grants: [
    {
      grantId: "g1",
      application: "platform",
      roleName: "Manager",
      resource: "project:4",
      endsAt: "2027-01-01T00:00:00.000Z",
      active: true,
    },
    {
      grantId: "g2",
      application: null,
      roleName: "Old",
      resource: null,
      endsAt: "2026-01-01T00:00:00.000Z",
      active: false,
    },
  ],
  bans: [
    {
      banId: "b2",
      application: null,
      rules: ["fraud"],
      statement: "Fraud.",
      endsAt: "2026-01-01T00:00:00.000Z",
      active: false,
    },
    { banId: "b3", application: null, rules: ["abuse"], statement: "Abuse.", endsAt: null, active: true },
    {
      banId: "b1",
      application: "platform",
      rules: ["spam"],
      statement: "Spam.",
      endsAt: "2026-12-01T00:00:00.000Z",
      active: true,
    },
  ],
};

const setUp = (rules = [{ application: null, code: "spam", title: "No spam" }]) => {
  const actions = {
    find: vi.fn(async (query: string) =>
      query === "nobody"
        ? { status: "refused" as const, reason: "no-account" }
        : { status: "done" as const, ...account },
    ),
    grant: vi.fn(async () => ({ status: "done" as const })),
    revoke: vi.fn(async () => ({ status: "done" as const })),
    ban: vi.fn(async () => ({ status: "done" as const })),
  };
  renderAccountScreen(
    <AccountAdministration
      locale="en"
      roles={[{ application: "platform", key: "manager", name: "Manager" }]}
      rules={rules}
      banApplications={["platform"]}
      {...actions}
    />,
  );
  return actions;
};

const search = async (query: string) => {
  fireEvent.change(screen.getByLabelText("Find an account"), { target: { value: query } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Search" })));
};

test("finds an account, or says nobody has that identifier", async () => {
  const actions = setUp();
  await search("nobody");
  expect(screen.getByRole("alert").textContent).toBe("No account has that identifier or email.");
  await search("@ana");
  expect(actions.find).toHaveBeenLastCalledWith("ana");
  expect(screen.getByText("@ana")).toBeTruthy();
  expect(screen.getByText(/project:4/)).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Take away" })).toHaveLength(1);
});

test("gives a role with its options, takes one away, and bans citing rules", async () => {
  const actions = setUp();
  await search("ana");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Take away" })));
  expect(actions.revoke).toHaveBeenCalledWith("g1");
  fireEvent.click(screen.getByRole("button", { name: "Give role" }));
  fireEvent.change(screen.getByLabelText("Reason (optional)"), { target: { value: "Runs it" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(actions.grant).toHaveBeenCalledWith({
    accountId: "a1",
    application: "platform",
    role: "manager",
    reason: "Runs it",
  });
  fireEvent.click(screen.getByRole("button", { name: "Ban" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(screen.getByRole("alert").textContent).toBe("Pick at least one rule.");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("Statement of reasons (the account sees it)"), {
    target: { value: " Spam again. " },
  });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(actions.ban).toHaveBeenCalledWith({
    accountId: "a1",
    application: "platform",
    rules: ["spam"],
    statement: "Spam again.",
  });
});

test("without rules, nobody can be banned; an account without roles or bans says so", async () => {
  const actions = setUp([]);
  actions.find.mockResolvedValue({ status: "done", ...account, grants: [], bans: [] } as never);
  await search("ana");
  expect(screen.getByText("No rules yet: until there are, nobody can be banned.")).toBeTruthy();
  expect(screen.getByText("Only the default roles.")).toBeTruthy();
  expect(screen.getByText("No bans.")).toBeTruthy();
});
