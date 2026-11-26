// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { OverviewPanel } from "@sharadox/account-web-library/overview-panel";

afterEach(cleanup);

test("who the account is, then a card per area with its number, each leading to its section", () => {
  render(
    <OverviewPanel
      locale="en"
      who={{ name: "Ana", identifier: "ana", pictureUrl: null }}
      counts={{ methods: 3, required: 1, devices: 2, unread: 4 }}
    />,
  );
  expect(screen.getByRole("heading", { name: "Ana" })).toBeTruthy();
  expect(screen.getByText("@ana")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Edit Profile" }).getAttribute("href")).toBe("/en/profile#name");
  expect(
    screen.getByRole("link", { name: /Authentication Methods 3 ways to sign in 1 required/ }).getAttribute("href"),
  ).toBe("/en/security#methods");
  expect(screen.getByRole("link", { name: /Devices 2 signed in/ }).getAttribute("href")).toBe("/en/security#devices");
  expect(screen.getByRole("link", { name: /Inbox 4 unread/ }).getAttribute("href")).toBe("/en/notifications#inbox");
  expect(screen.getByRole("link", { name: /Download Your Data/ }).getAttribute("href")).toBe("/en/data#download");
});

test("one of each reads in the singular, in Portuguese too", () => {
  render(
    <OverviewPanel
      locale="pt"
      who={{ name: "Rui", identifier: "rui", pictureUrl: "/picture/a.webp" }}
      counts={{ methods: 1, required: 0, devices: 1, unread: 1 }}
    />,
  );
  expect(screen.getByRole("link", { name: /1 forma de entrar 0 obrigatórias/ })).toBeTruthy();
  expect(screen.getByRole("link", { name: /1 com sessão iniciada/ })).toBeTruthy();
  expect(screen.getByRole("link", { name: /1 por ler/ })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Editar Perfil" })).toBeTruthy();
});

test("while on their way, only the picture, the name and the numbers are skeletons: the cards show at once", () => {
  const { container } = render(<OverviewPanel locale="en" />);
  expect(screen.getAllByRole("link")).toHaveLength(5);
  expect(screen.getByText("Devices")).toBeTruthy();
  expect(screen.getAllByRole("status", { name: "Loading…" })).toHaveLength(5);
  expect(container.querySelectorAll("[aria-hidden=true]").length).toBeGreaterThanOrEqual(2);
});
