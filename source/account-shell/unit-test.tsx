// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { accountAreas } from "@sharadox/account-web-library/account-area";
import { AccountShell } from "@sharadox/account-web-library/account-shell";

afterEach(cleanup);

test("the areas across the top, the open area's sections down the side, the section's heading", () => {
  render(
    <AccountShell
      locale="en"
      areas={accountAreas({ locale: "en", administrator: false })}
      area="security"
      section="devices"
      description="Where you're signed in."
    >
      <p>Content</p>
    </AccountShell>,
  );
  const areas = screen.getByRole("navigation", { name: "Account areas" });
  expect(within(areas).getAllByRole("link")).toHaveLength(5);
  expect(within(areas).getByRole("link", { name: "Security" }).getAttribute("aria-current")).toBe("page");
  const sections = screen.getByRole("navigation", { name: "Sections" });
  expect(within(sections).getByRole("link", { name: "Devices" }).getAttribute("aria-current")).toBe("page");
  expect(within(sections).getByRole("link", { name: "Activity" }).getAttribute("aria-current")).toBeNull();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Devices");
  expect(screen.getByText("Where you're signed in.")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Devices" }).textContent).toContain("Content");
});

test("one section needs no side menu; a title can replace the section's name", () => {
  const areas = accountAreas({ locale: "pt", administrator: true });
  const { rerender } = render(
    <AccountShell locale="pt" areas={areas} area="overview" section="summary">
      <p>Resumo</p>
    </AccountShell>,
  );
  expect(screen.queryByRole("navigation", { name: "Secções" })).toBeNull();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Resumo");
  rerender(
    <AccountShell locale="pt" areas={areas} area="administration" section="nowhere" title="Contas">
      <p />
    </AccountShell>,
  );
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Contas");
  rerender(
    <AccountShell locale="pt" areas={areas} area="administration" section="nowhere">
      <p />
    </AccountShell>,
  );
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Administração");
  rerender(
    <AccountShell locale="pt" areas={[]} area="administration" section="nowhere">
      <p />
    </AccountShell>,
  );
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("");
});
