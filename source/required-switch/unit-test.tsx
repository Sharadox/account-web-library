// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { RequiredSwitch } from "@sharadox/account-web-library/required-switch";

afterEach(cleanup);

test("a switch read as on or off, busy while it changes", async () => {
  let finish: () => void = () => {};
  const change = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
  render(<RequiredSwitch label="Required" checked={false} onChange={change} />);
  const toggle = screen.getByRole("switch", { name: "Required" });
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  fireEvent.click(toggle);
  expect(change).toHaveBeenCalledWith(true);
  expect(toggle.getAttribute("aria-busy")).toBe("true");
  await act(async () => finish());
  expect(toggle.getAttribute("aria-busy")).toBeNull();
});
