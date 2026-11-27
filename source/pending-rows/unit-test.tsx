// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { PendingRows } from "@sharadox/account-web-library/pending-rows";

afterEach(cleanup);

test("rows shaped like the list's, each value a skeleton, said once to be loading", () => {
  const { container } = render(
    <PendingRows locale="en" rows={3} values={["20ch", "12ch"]} icon="device" className="list" rowClassName="row" />,
  );
  const list = container.querySelector("ul")!;
  expect(list.className).toBe("list");
  expect(list.getAttribute("aria-busy")).toBe("true");
  expect(list.querySelectorAll("li.row")).toHaveLength(3);
  expect(list.querySelectorAll("li:first-child svg")).toHaveLength(1);
  expect(screen.getAllByRole("status", { name: "Loading…" })).toHaveLength(1);
});

test("an ordered list without icons, in Portuguese", () => {
  const { container } = render(<PendingRows locale="pt" rows={2} values={["10ch"]} ordered />);
  expect(container.querySelectorAll("ol > li")).toHaveLength(2);
  expect(container.querySelectorAll("svg")).toHaveLength(0);
  expect(screen.getAllByRole("status", { name: "A carregar…" })).toHaveLength(1);
});
