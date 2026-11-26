// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DownloadPanel } from "@sharadox/account-web-library/download-panel";
import { ToastProvider } from "@sharadox/interface-web-library/toast";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const setUp = (locale: "en" | "pt" = "en") =>
  render(
    <ToastProvider label="Notifications" dismissLabel="Dismiss">
      <DownloadPanel locale={locale} href="/en/export" />
    </ToastProvider>,
  );

test("a download link (a plain one without JavaScript), in the reader's language", () => {
  setUp("pt");
  const link = screen.getByRole("link", { name: "Transferir os Meus Dados" });
  expect(link.getAttribute("href")).toBe("/en/export");
  expect(link.hasAttribute("download")).toBe(true);
});

test("a click fetches the file with a loader on the link, then saves it under the server's name", async () => {
  let answer: (response: Response) => void = () => {};
  vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise((resolve) => (answer = resolve)));
  const saved = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    saved(this.download);
  });
  URL.createObjectURL = () => "blob:file";
  URL.revokeObjectURL = vi.fn();
  setUp();
  fireEvent.click(screen.getByRole("link", { name: "Download My Data" }));
  const busy = screen.getByRole("link", { name: "Preparing Your File…" });
  expect(busy.getAttribute("aria-busy")).toBe("true");
  // A second click meanwhile does nothing more.
  fireEvent.click(busy);
  expect(globalThis.fetch).toHaveBeenCalledOnce();
  await act(async () =>
    answer(new Response("{}", { headers: { "content-disposition": 'attachment; filename="ana.json"' } })),
  );
  expect(saved).toHaveBeenCalledWith("ana.json");
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:file");
  expect(screen.getByRole("link", { name: "Download My Data" }).getAttribute("aria-busy")).toBeNull();
});

test("a file that can't come is notified; one without a name still saves", async () => {
  const saved = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    saved(this.download);
  });
  URL.createObjectURL = () => "blob:file";
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("", { status: 500 }));
  setUp();
  await act(async () => fireEvent.click(screen.getByRole("link", { name: "Download My Data" })));
  expect(screen.getByRole("alert").textContent).toContain("Something went wrong.");
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}"));
  await act(async () => fireEvent.click(screen.getByRole("link", { name: "Download My Data" })));
  expect(saved).toHaveBeenCalledWith("");
});
