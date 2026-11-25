// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { EditablePanel } from "@sharadox/account-web-library/editable-field";
import { ToastProvider } from "@sharadox/account-web-library/toast";

afterEach(cleanup);

const setUp = (onSave: (form: FormData) => Promise<string | null>) =>
  render(
    <ToastProvider label="Notifications" dismissLabel="Dismiss">
      <EditablePanel
        locale="en"
        label="Name"
        view="Ana"
        fields={<input name="name" aria-label="New name" defaultValue="Ana" />}
        onSave={onSave}
        extra={<button>Other</button>}
      />
    </ToastProvider>,
  );

test("read-only until Edit; Save shows a loader, then a notification and the view again", async () => {
  let finish: (value: string | null) => void = () => {};
  const save = vi.fn((form: FormData) => {
    expect(form.get("name")).toBe("Bea");
    return new Promise<string | null>((resolve) => (finish = resolve));
  });
  setUp(save);
  expect(screen.queryByLabelText("New name")).toBeNull();
  expect(screen.getByText("Ana")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Other" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("New name"), { target: { value: "Bea" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByRole("button", { name: "Saving…" }).getAttribute("aria-busy")).toBe("true");
  await act(async () => finish(null));
  expect(screen.queryByLabelText("New name")).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("Saved.");
});

test("a refusal stays on the form; Discard and Escape leave the value as it was", async () => {
  setUp(async () => "A name has 1 to 50 characters.");
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save" })));
  expect(screen.getByRole("alert").textContent).toBe("A name has 1 to 50 characters.");
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("Ana")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.keyDown(screen.getByLabelText("New name"), { key: "Enter" });
  fireEvent.keyDown(screen.getByLabelText("New name"), { key: "Escape" });
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
