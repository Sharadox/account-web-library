// @vitest-environment happy-dom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { RoleAdministration } from "@sharadox/account-web-library/role-administration";
import { endDialogAnimations, openDialogs, renderAccountScreen } from "@sharadox/account-web-library/test-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
beforeAll(openDialogs);
afterEach(cleanup);

test("roles per application with their holders; deleting asks first, with how many lose it", async () => {
  const remove = vi.fn(async () => ({ status: "done" as const }));
  renderAccountScreen(
    <RoleAdministration
      locale="en"
      remove={remove}
      roles={[
        { application: "account", key: "administrator", name: "Administrator", holders: 1, protected: false },
        { application: "platform", key: "member", name: "Member", holders: 0, protected: true },
        { application: "platform", key: "manager", name: "Manager", holders: 3, protected: false },
      ]}
    />,
  );
  expect(screen.getByRole("heading", { name: "platform" })).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Delete Role" })).toHaveLength(2);
  fireEvent.click(screen.getAllByRole("button", { name: "Delete Role" })[1]!);
  expect(screen.getByText(/It will be taken from every account/).textContent).toContain("3 accounts");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Delete Role" })[1]!);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Delete Role" })[1]!);
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Delete" })));
  expect(remove).toHaveBeenCalledWith("platform", "manager");
  act(endDialogAnimations);
  expect(screen.queryByText(/It will be taken/)).toBeNull();
});
