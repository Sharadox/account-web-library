// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { OverviewPanel } from "@sharadox/account-web-library/overview-panel";

afterEach(cleanup);

test("who the account is, and a card per area with its number, each a link", () => {
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
  expect(screen.getByRole("link", { name: /Hello, Ana @ana/ }).getAttribute("href")).toBe("/en/profile/identity");
  expect(screen.getByRole("link", { name: /3 ways to sign in · 1 required/ }).getAttribute("href")).toBe(
    "/en/security/methods",
  );
  expect(screen.getByRole("link", { name: /2 devices signed in/ }).getAttribute("href")).toBe("/en/security/devices");
  expect(screen.getByRole("link", { name: /4 unread notifications/ }).getAttribute("href")).toBe(
    "/en/notifications/inbox",
  );
  expect(screen.getByRole("link", { name: /Privacy/ }).getAttribute("href")).toBe("/en/privacy/download");
});
