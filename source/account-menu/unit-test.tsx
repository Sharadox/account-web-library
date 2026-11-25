// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AccountMenu } from "@sharadox/account-web-library/account-menu";
import type { AccountMenuProperties } from "@sharadox/account-web-library/account-menu/type";

afterEach(cleanup);

const ana = { accountId: "a", name: "Ana Silva", identifier: "ana", pictureUrl: null, roles: ["Administrator"] };
const bea = { accountId: "b", name: "Bea", identifier: "bea", pictureUrl: "/picture/b.webp" };

const menu = (overrides: Partial<AccountMenuProperties> = {}) =>
  render(
    <div>
      <AccountMenu
        locale="en"
        current={ana}
        others={[]}
        signInHref="/en/sign-in"
        settingsHref="/en"
        switchAccount={vi.fn()}
        signOut={vi.fn()}
        {...overrides}
      />
      <p>Outside</p>
    </div>,
  );

const open = () => fireEvent.click(screen.getByRole("button", { name: "Account menu: Ana Silva" }));

test("one account: who it is with its role chips, settings, add another, sign out; no switching", () => {
  menu();
  open();
  expect(screen.getByText("@ana")).toBeTruthy();
  expect(screen.getByRole("list", { name: "Roles" }).textContent).toBe("Administrator");
  expect(screen.getByRole("link", { name: "Account settings" }).getAttribute("href")).toBe("/en");
  expect(screen.getByRole("link", { name: "Add another account" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Switch account" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Sign out of all accounts" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Administration" })).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: "Account settings" }));
  expect(screen.queryByRole("link", { name: "Account settings" })).toBeNull();
});

test("several accounts: Switch account turns the menu into the list, Back returns; sign out of all", () => {
  menu({ others: [bea], administrationHref: "/en/administration/accounts", current: { ...ana, roles: [] } });
  open();
  expect(screen.queryByRole("list", { name: "Roles" })).toBeNull();
  expect(screen.getByRole("link", { name: "Administration" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Add another account" })).toBeNull();
  expect(screen.getByRole("button", { name: "Sign out of all accounts" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Switch account" }));
  expect(screen.queryByRole("link", { name: "Account settings" })).toBeNull();
  expect(document.querySelector('[aria-current="true"]')!.textContent).toContain("Ana Silva");
  const switchTo = screen.getByRole("button", { name: /Bea/ });
  expect((switchTo.closest("form")!.querySelector("input") as HTMLInputElement).value).toBe("b");
  expect(screen.getByRole("link", { name: "Add another account" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("link", { name: "Account settings" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Switch account" }));
  fireEvent.click(screen.getByRole("link", { name: "Add another account" }));
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
});

test("Escape, a click outside or the picture again closes it", () => {
  menu();
  open();
  fireEvent.keyDown(document, { key: "a" });
  fireEvent.pointerDown(screen.getByText("@ana"));
  expect(screen.queryByText("@ana")).not.toBeNull();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByText("@ana")).toBeNull();
  open();
  fireEvent.pointerDown(screen.getByText("Outside"));
  expect(screen.queryByText("@ana")).toBeNull();
  open();
  open();
  expect(screen.queryByText("@ana")).toBeNull();
});

test("signing out posts the account, or nothing for all", async () => {
  menu({ others: [bea] });
  open();
  const one = screen.getByRole("button", { name: "Sign out" }).closest("form")!;
  expect((one.querySelector("input") as HTMLInputElement).value).toBe("a");
  const all = screen.getByRole("button", { name: "Sign out of all accounts" }).closest("form")!;
  expect((all.querySelector("input") as HTMLInputElement).value).toBe("");
  await act(async () => fireEvent.submit(all));
  expect(screen.queryByText("@ana")).toBeNull();
});

test("switching keeps the menu open with a loader on the chosen account, then closes it on the same page", async () => {
  let finish: () => void = () => {};
  const switchAccount = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
  menu({ others: [bea], switchAccount });
  open();
  fireEvent.click(screen.getByRole("button", { name: "Switch account" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /Bea/ })));
  expect(switchAccount).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: /Bea/ }).getAttribute("aria-busy")).toBe("true");
  await act(async () => finish());
  expect(screen.queryByRole("button", { name: /Bea/ })).toBeNull();
});

test("signing out shows a loader on its button", async () => {
  let finish: () => void = () => {};
  const signOut = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
  menu({ signOut });
  open();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sign out" })));
  expect(screen.getByRole("button", { name: "Sign out" }).getAttribute("aria-busy")).toBe("true");
  await act(async () => finish());
  expect(screen.queryByText("@ana")).toBeNull();
});
