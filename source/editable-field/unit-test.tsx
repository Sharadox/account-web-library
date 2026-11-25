// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { EditablePanel } from "@sharadox/account-web-library/editable-field";
import type { EditablePanelProperties } from "@sharadox/account-web-library/editable-field/type";
import { ToastProvider } from "@sharadox/interface-web-library/toast";

afterEach(cleanup);

const panel = (properties: Partial<EditablePanelProperties> & Pick<EditablePanelProperties, "onSave">) => (
  <ToastProvider label="Notifications" dismissLabel="Dismiss">
    <EditablePanel
      locale="en"
      label="Name"
      view="Ana"
      fields={<input name="name" aria-label="New name" defaultValue="Ana" />}
      extra={<button>Other</button>}
      {...properties}
    />
  </ToastProvider>
);

test("read-only until Edit; Save shows the new value at once, marked as saving, then a notification", async () => {
  let finish: (value: string | null) => void = () => {};
  const save = vi.fn((form: FormData) => {
    expect(form.get("name")).toBe("Bea");
    return new Promise<string | null>((resolve) => (finish = resolve));
  });
  const { rerender } = render(panel({ onSave: save, preview: (form) => String(form.get("name")) }));
  expect(screen.queryByLabelText("New name")).toBeNull();
  expect(screen.getByText("Ana")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Other" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("New name"), { target: { value: "Bea" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByText("Bea")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe("Saving…");
  expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  await act(async () => finish(null));
  // Saved: the new value stays until the page's own value arrives.
  expect(screen.getByText("Bea")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Notifications" }).textContent).toContain("Saved.");
  rerender(panel({ onSave: save, preview: (form) => String(form.get("name")), view: "Bea" }));
  expect(screen.getByText("Bea")).toBeTruthy();
  rerender(panel({ onSave: save, preview: (form) => String(form.get("name")), view: "Cid" }));
  expect(screen.getByText("Cid")).toBeTruthy();
});

test("a refusal brings the form back with what was typed and the reason", async () => {
  let finish: (value: string | null) => void = () => {};
  render(
    panel({
      onSave: () => new Promise<string | null>((resolve) => (finish = resolve)),
      preview: (form) => String(form.get("name")),
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("New name"), { target: { value: "Bea" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await act(async () => finish("That name is taken."));
  expect(screen.getByRole("alert").textContent).toBe("That name is taken.");
  expect((screen.getByLabelText("New name") as HTMLInputElement).value).toBe("Bea");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByText("Ana")).toBeTruthy();
});

test("without a preview, Save keeps the form with a loader; Cancel and Escape leave the value as it was", async () => {
  let finish: (value: string | null) => void = () => {};
  render(panel({ onSave: () => new Promise<string | null>((resolve) => (finish = resolve)) }));
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByRole("button", { name: "Saving…" }).getAttribute("aria-busy")).toBe("true");
  await act(async () => finish("A name has 1 to 50 characters."));
  expect(screen.getByRole("alert").textContent).toBe("A name has 1 to 50 characters.");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("Ana")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.keyDown(screen.getByLabelText("New name"), { key: "Enter" });
  fireEvent.keyDown(screen.getByLabelText("New name"), { key: "Escape" });
  expect(screen.queryByLabelText("New name")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    finish(null);
  });
  expect(screen.queryByLabelText("New name")).toBeNull();
});

test("the Edit button can say something else", () => {
  render(
    <EditablePanel
      locale="pt"
      label="Aniversário"
      view="—"
      fields={null}
      onSave={async () => null}
      editLabel="Adicionar"
    />,
  );
  expect(screen.getByRole("button", { name: "Adicionar" })).toBeTruthy();
});
