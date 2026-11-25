// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { OverviewPanel } from "@sharadox/account-web-library/overview-panel";

afterEach(cleanup);

test("who the account is, then a card per area with its number, each leading to its section", () => {
  render(
    <OverviewPanel
      locale="en"
      name="Ana"
      identifier="ana"
      pictureUrl={null}
      methods={3}
      required={1}
      devices={2}
      unread={4}
    />,
  );
  expect(screen.getByRole("heading", { name: "Ana" })).toBeTruthy();
  expect(screen.getByText("@ana")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Edit profile" }).getAttribute("href")).toBe("/en/profile#identity");
  expect(
    screen.getByRole("link", { name: /Sign-In Methods 3 ways to sign in · 1 required/ }).getAttribute("href"),
  ).toBe("/en/security#methods");
  expect(screen.getByRole("link", { name: /Devices 2 signed in/ }).getAttribute("href")).toBe("/en/security#devices");
  expect(screen.getByRole("link", { name: /Inbox 4 unread/ }).getAttribute("href")).toBe("/en/notifications#inbox");
  expect(screen.getByRole("link", { name: /Download Your Data/ }).getAttribute("href")).toBe("/en/privacy#download");
});

test("one of each reads in the singular, in Portuguese too", () => {
  render(
    <OverviewPanel
      locale="pt"
      name="Rui"
      identifier="rui"
      pictureUrl="/picture/a.webp"
      methods={1}
      required={0}
      devices={1}
      unread={1}
    />,
  );
  expect(screen.getByRole("link", { name: /1 forma de entrar · 0 obrigatórias/ })).toBeTruthy();
  expect(screen.getByRole("link", { name: /1 com sessão iniciada/ })).toBeTruthy();
  expect(screen.getByRole("link", { name: /1 por ler/ })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Editar perfil" })).toBeTruthy();
});
