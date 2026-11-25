// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { PicturePanel } from "@sharadox/account-web-library/picture-panel";
import { renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
afterEach(cleanup);

const choose = (file?: File) => {
  const input = screen.getByLabelText("Choose a picture", { selector: "input" }) as HTMLInputElement;
  Object.defineProperty(input, "files", { value: file ? [file] : [], configurable: true });
  return act(async () => fireEvent.change(input));
};

test("choosing a file uploads it at once; too big is refused here; nothing chosen does nothing", async () => {
  const upload = vi.fn(async () => ({ status: "done" as const }));
  renderAccountScreen(<PicturePanel locale="en" name="Ana" pictureUrl={null} upload={upload} remove={vi.fn()} />);
  const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
  fireEvent.click(screen.getByRole("button", { name: "Choose a picture" }));
  expect(click).toHaveBeenCalled();
  await choose();
  expect(upload).not.toHaveBeenCalled();
  await choose(new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" }));
  expect(screen.getByRole("alert").textContent).toContain("over 5 MB");
  await choose(new File([new Uint8Array(10)], "small.png", { type: "image/png" }));
  expect((upload.mock.calls[0] as unknown as [FormData])[0].get("picture")).toBeInstanceOf(File);
  // Uploaded: the new picture stays (until the page has it), so it can be removed.
  expect(screen.getByRole("button", { name: "Remove picture" })).toBeTruthy();
});

test("a picture can be removed", async () => {
  const remove = vi.fn(async () => ({ status: "done" as const }));
  renderAccountScreen(
    <PicturePanel locale="en" name="Ana" pictureUrl="/picture/a.webp" upload={vi.fn()} remove={remove} />,
  );
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Remove picture" })));
  expect(remove).toHaveBeenCalledOnce();
  expect(screen.getByRole("status").textContent).toContain("Done.");
});

test("the chosen picture shows at once while it uploads, and goes back if it's refused", async () => {
  URL.createObjectURL = vi.fn(() => "blob:chosen");
  URL.revokeObjectURL = vi.fn();
  let finish: (answer: { status: "done" } | { status: "refused"; reason: string }) => void = () => {};
  const upload = vi.fn(
    () => new Promise<{ status: "done" } | { status: "refused"; reason: string }>((resolve) => (finish = resolve)),
  );
  renderAccountScreen(<PicturePanel locale="en" name="Ana" pictureUrl={null} upload={upload} remove={vi.fn()} />);
  await choose(new File([new Uint8Array(10)], "small.png", { type: "image/png" }));
  expect(document.querySelector("img")!.getAttribute("src")).toBe("blob:chosen");
  expect(screen.getAllByRole("status").some((status) => status.textContent === "Uploading…")).toBe(true);
  await act(async () => finish({ status: "refused", reason: "type" }));
  expect(document.querySelector("img")).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:chosen");
});

test("a removed picture goes at once, and comes back if removing fails", async () => {
  let finish: (answer: { status: "done" } | { status: "refused"; reason: string }) => void = () => {};
  const remove = vi.fn(
    () => new Promise<{ status: "done" } | { status: "refused"; reason: string }>((resolve) => (finish = resolve)),
  );
  renderAccountScreen(
    <PicturePanel locale="en" name="Ana" pictureUrl="/picture/a.webp" upload={vi.fn()} remove={remove} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove picture" }));
  expect(document.querySelector("img")).toBeNull();
  await act(async () => finish({ status: "refused", reason: "generic" }));
  expect(document.querySelector("img")!.getAttribute("src")).toBe("/picture/a.webp");
});
