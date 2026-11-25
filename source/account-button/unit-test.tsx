// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AccountButton } from "@sharadox/account-web-library/account-button";

afterEach(cleanup);

test("a button with its look and icon, that clicks", () => {
  const click = vi.fn();
  render(
    <AccountButton look="quiet" icon="plus" onClick={click} className="extra">
      Add
    </AccountButton>,
  );
  const button = screen.getByRole("button", { name: "Add" });
  expect(button.getAttribute("type")).toBe("button");
  expect(button.className).toContain("extra");
  expect(button.querySelector("svg")).not.toBeNull();
  fireEvent.click(button);
  expect(click).toHaveBeenCalledOnce();
});

test("while pending: a spinner, its pending words, busy, and no clicks", () => {
  const click = vi.fn();
  const { rerender } = render(
    <AccountButton type="submit" pending pendingLabel="Saving…" onClick={click}>
      Save
    </AccountButton>,
  );
  const button = screen.getByRole("button", { name: "Saving…" });
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(button);
  expect(click).not.toHaveBeenCalled();
  rerender(
    <AccountButton pending look="danger">
      Delete
    </AccountButton>,
  );
  expect(screen.getByRole("button", { name: "Delete" }).getAttribute("aria-busy")).toBe("true");
});
