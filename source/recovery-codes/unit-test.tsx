// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { RecoveryCodes } from "@sharadox/account-web-library/recovery-codes";
import { renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
afterEach(cleanup);

test("offered once an authenticator is on; made only when asked, shown once with Copy All", async () => {
  const make = vi.fn(async () => ({ status: "done" as const, recoveryCodes: ["AAAA-BBBB", "CCCC-DDDD"] }));
  renderAccountScreen(<RecoveryCodes locale="en" authenticators left={0} make={make} />);
  expect(screen.getByText("codes left", { exact: false }).textContent).toContain("0");
  expect(make).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Make Recovery Codes" })));
  expect(screen.getAllByRole("listitem").map(({ textContent }) => textContent)).toEqual(["AAAA-BBBB", "CCCC-DDDD"]);
  expect(screen.getByRole("button", { name: "Copy All" })).toBeTruthy();
});

test("with codes left the button makes a new set; without authenticators there is nothing", () => {
  const { unmount } = renderAccountScreen(<RecoveryCodes locale="en" authenticators left={7} make={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Make New Codes" })).toBeTruthy();
  unmount();
  const { container } = renderAccountScreen(
    <RecoveryCodes locale="en" authenticators={false} left={0} make={vi.fn()} />,
  );
  expect(container.querySelector("h2")).toBeNull();
});
