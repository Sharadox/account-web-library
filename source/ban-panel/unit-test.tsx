// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { BanPanel } from "@sharadox/account-web-library/ban-panel";
import { renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
afterEach(cleanup);

const ban = {
  banId: "b1",
  rules: ["spam", "abuse"],
  statement: "Sent spam.",
  endsAt: "2026-12-01T10:00:00.000Z",
  active: true,
  appeal: null,
};

test("no bans: a thank-you", () => {
  renderAccountScreen(<BanPanel locale="en" bans={[]} rulesHref="/en/rules" appeal={vi.fn()} />);
  expect(screen.getByText("No bans. Thank you for keeping to the rules.")).toBeTruthy();
});

test("a ban with its rules linked; one appeal, written then sent", async () => {
  const appeal = vi.fn(async () => ({ status: "done" as const }));
  renderAccountScreen(<BanPanel locale="en" bans={[ban]} rulesHref="/en/rules" appeal={appeal} />);
  expect(screen.getByText(/Active/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "abuse" }).getAttribute("href")).toBe("/en/rules#abuse");
  fireEvent.click(screen.getAllByRole("button", { name: "Appeal" })[0]!);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(screen.getByRole("alert").textContent).toContain("Something went wrong.");
  fireEvent.change(screen.getByLabelText("Why should this ban change?"), { target: { value: "It wasn't spam." } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(appeal).toHaveBeenCalledWith("b1", "It wasn't spam.");
});

test("an appeal waiting, or decided with its reasons; a permanent ended ban", () => {
  renderAccountScreen(
    <BanPanel
      locale="en"
      rulesHref="/en/rules"
      appeal={vi.fn()}
      bans={[
        { ...ban, appeal: { text: "x", decision: null, reasons: null } },
        {
          ...ban,
          banId: "b2",
          active: false,
          endsAt: null,
          appeal: { text: "x", decision: "lifted", reasons: "Our mistake." },
        },
        { ...ban, banId: "b3", appeal: { text: "x", decision: "upheld", reasons: null } },
      ]}
    />,
  );
  expect(screen.getByText("Your appeal was sent. You'll hear back here.")).toBeTruthy();
  expect(screen.getByText("Ended").parentElement!.textContent).toContain("Permanent");
  expect(screen.getByText("Ban Lifted").parentElement!.textContent).toBe("Ban Lifted: Our mistake.");
  expect(screen.getByText("Ban Upheld").parentElement!.textContent).toBe("Ban Upheld");
});

test("while the bans are on their way, one card of value skeletons, not the no-bans line", () => {
  renderAccountScreen(<BanPanel locale="en" rulesHref="/en/rules" appeal={vi.fn()} />);
  expect(screen.getAllByRole("status", { name: "Loading…" })).toHaveLength(1);
  expect(screen.queryByText(/never been banned|No bans/i)).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});
