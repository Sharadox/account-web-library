// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { useAccountAction } from "@sharadox/account-web-library/account-action";
import { openDialogs, renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
beforeAll(openDialogs);
afterEach(cleanup);

function NeedsCode() {
  const { run } = useAccountAction();
  let calls = 0;
  return (
    <button
      onClick={() =>
        void run(async () => (++calls === 1 ? { status: "step-up" } : { status: "done" }), { success: "Done." })
      }
    >
      go
    </button>
  );
}

test("its step-up sends a code and takes only 123456", async () => {
  renderAccountScreen(<NeedsCode />);
  await act(async () => fireEvent.click(screen.getByText("go")));
  const paste = (text: string) =>
    act(
      async () => void fireEvent.paste(screen.getAllByRole("textbox")[0]!, { clipboardData: { getData: () => text } }),
    );
  await paste("000000");
  expect(screen.getAllByRole("alert").some((alert) => alert.textContent === "That code isn't right.")).toBe(true);
  await paste("123456");
  expect(screen.getByRole("status").textContent).toContain("Done.");
});
