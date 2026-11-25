// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { DownloadPanel } from "@sharadox/account-web-library/download-panel";

afterEach(cleanup);

test("a link that downloads the data", () => {
  render(<DownloadPanel locale="pt" href="/pt/export" />);
  const link = screen.getByRole("link", { name: "Transferir os meus dados" });
  expect(link.getAttribute("href")).toBe("/pt/export");
  expect(link.hasAttribute("download")).toBe(true);
});
