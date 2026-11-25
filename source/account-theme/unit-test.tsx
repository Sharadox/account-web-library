// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { AccountTheme, accountThemeStyle } from "@sharadox/account-web-library/account-theme";

afterEach(cleanup);

test("turns a theme into custom properties on one wrapper, for the account screens and the interface pieces", () => {
  expect(accountThemeStyle({ surfaceRaised: "#111", barHeight: "72px" })).toEqual({
    "--account-surface-raised": "#111",
    "--account-bar-height": "72px",
    "--interface-surface-raised": "#111",
    "--interface-bar-height": "72px",
  });
  const { container } = render(
    <AccountTheme theme={{ accent: "gold" }} className="frame">
      <p>Inside</p>
    </AccountTheme>,
  );
  const wrapper = container.firstElementChild as HTMLElement;
  expect(wrapper.className).toBe("frame");
  expect(wrapper.style.getPropertyValue("--account-accent")).toBe("gold");
  expect(wrapper.style.getPropertyValue("--interface-accent")).toBe("gold");
  expect(wrapper.textContent).toBe("Inside");
});
