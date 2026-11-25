// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DevicePanel } from "@sharadox/account-web-library/device-panel";
import { renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
afterEach(cleanup);

const safari =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test("each browser by name, this one marked; the others can be signed out", async () => {
  const end = vi.fn(async () => ({ status: "done" as const }));
  renderAccountScreen(
    <DevicePanel
      locale="en"
      end={end}
      devices={[
        {
          accountSessionId: "s1",
          userAgent: safari,
          signedInAt: "2026-11-20T10:00:00Z",
          lastSeenAt: "2026-11-25T10:00:00Z",
          secondFactor: true,
          current: true,
        },
        {
          accountSessionId: "s2",
          userAgent: null,
          signedInAt: "2026-11-21T10:00:00Z",
          lastSeenAt: "2026-11-22T10:00:00Z",
          secondFactor: false,
          current: false,
        },
      ]}
    />,
  );
  expect(screen.getByText(/Safari on iPhone/).textContent).toContain("This device");
  expect(screen.getByText(/more than one method/)).toBeTruthy();
  expect(screen.getByText("An unknown browser")).toBeTruthy();
  const buttons = screen.getAllByRole("button", { name: "Sign out there" });
  expect(buttons).toHaveLength(1);
  await act(async () => fireEvent.click(buttons[0]!));
  expect(end).toHaveBeenCalledWith("s2");
});
