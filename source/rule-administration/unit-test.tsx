// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { RuleAdministration } from "@sharadox/account-web-library/rule-administration";

afterEach(cleanup);

test("the rules with their penalties, or none yet, and the public page", () => {
  const { rerender } = render(
    <RuleAdministration
      locale="en"
      rulesHref="/en/rules"
      rules={[
        { application: null, code: "spam", title: "No spam", penalties: ["7 days", "30 days", "Permanent"] },
        { application: "platform", code: "fraud", title: "No fraud", penalties: ["Permanent"] },
      ]}
    />,
  );
  expect(screen.getByText("spam · Everywhere · 7 days → 30 days → Permanent")).toBeTruthy();
  expect(screen.getByText("fraud · platform · Permanent")).toBeTruthy();
  expect(screen.getByRole("link", { name: "See the Public Rules" }).getAttribute("href")).toBe("/en/rules");
  rerender(<RuleAdministration locale="en" rulesHref="/en/rules" rules={[]} />);
  expect(screen.getByText("No rules yet: until there are, nobody can be banned.")).toBeTruthy();
});
