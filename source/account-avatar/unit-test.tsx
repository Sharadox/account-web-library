// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { AccountAvatar, initials } from "@sharadox/account-web-library/account-avatar";

afterEach(cleanup);

test("initials: first and last words, whole characters", () => {
  expect(initials("Ana Maria Silva")).toBe("AS");
  expect(initials("luis")).toBe("L");
  expect(initials("🦊 Fox")).toBe("🦊F");
  expect(initials("   ")).toBe("?");
});

test("the picture when there is one, its initials otherwise", () => {
  const { container, rerender } = render(<AccountAvatar name="Ana Silva" pictureUrl="/picture/a.webp" size={44} />);
  const image = container.querySelector("img")!;
  expect(image.getAttribute("alt")).toBe("");
  expect(image.getAttribute("width")).toBe("44");
  rerender(<AccountAvatar name="Ana Silva" pictureUrl={null} className="mine" />);
  const span = container.querySelector("span")!;
  expect(span.textContent).toBe("AS");
  expect(span.className).toContain("mine");
  expect(span.style.getPropertyValue("--size")).toBe("36px");
});
