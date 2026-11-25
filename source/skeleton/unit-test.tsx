// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Skeleton } from "@sharadox/account-web-library/skeleton";

afterEach(cleanup);

test("lines or a block, said once to screen readers", () => {
  const { rerender } = render(<Skeleton label="Loading devices…" lines={4} />);
  expect(screen.getByRole("status", { name: "Loading devices…" }).children).toHaveLength(4);
  rerender(<Skeleton label="Loading" />);
  expect(screen.getByRole("status").children).toHaveLength(3);
  rerender(<Skeleton label="Loading picture" height={120} />);
  const block = screen.getByRole("status").firstElementChild as HTMLElement;
  expect(block.style.height).toBe("120px");
});
