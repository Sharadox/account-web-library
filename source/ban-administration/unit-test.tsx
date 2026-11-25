// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { BanAdministration } from "@sharadox/account-web-library/ban-administration";

afterEach(cleanup);

test("everyone banned now, or nobody", () => {
  const { rerender } = render(
    <BanAdministration
      locale="en"
      bans={[
        {
          banId: "1",
          identifier: "ana",
          application: "platform",
          rules: ["spam"],
          statement: "Spam.",
          endsAt: "2026-12-01T00:00:00.000Z",
        },
        { banId: "2", identifier: "bea", application: null, rules: ["fraud"], statement: "Fraud.", endsAt: null },
      ]}
    />,
  );
  expect(screen.getByText("@ana")).toBeTruthy();
  expect(screen.getByText(/Everywhere · fraud · Permanent/)).toBeTruthy();
  expect(screen.getByText(/platform · spam · Until/)).toBeTruthy();
  rerender(<BanAdministration locale="en" bans={[]} />);
  expect(screen.getByText("Nobody is banned.")).toBeTruthy();
});
