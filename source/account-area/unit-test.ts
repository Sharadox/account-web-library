import { expect, test } from "vitest";
import {
  accountAreaOfPath,
  accountAreas,
  accountSectionPath,
  isAccountSection,
} from "@sharadox/account-web-library/account-area";

test("six areas for administrators, five for everyone else, each one page with its sections to jump to", () => {
  const all = accountAreas({ locale: "en", administrator: true });
  expect(all.map(({ label }) => label)).toEqual([
    "Overview",
    "Profile",
    "Security",
    "Notifications",
    "Privacy",
    "Administration",
  ]);
  expect(all[2]!.sections).toEqual([
    { key: "methods", label: "Sign-In Methods", href: "/en/security#methods" },
    { key: "devices", label: "Devices", href: "/en/security#devices" },
    { key: "activity", label: "Activity", href: "/en/security#activity" },
  ]);
  expect(all[0]!.href).toBe("/en");
  expect(all[1]!.href).toBe("/en/profile");
  const people = accountAreas({ locale: "pt", administrator: false });
  expect(people.map(({ key }) => key)).not.toContain("administration");
  expect(people[1]!.label).toBe("Perfil");
});

test("addresses, the sections that exist, and the area an address is in", () => {
  // The privacy area's address leaves /privacy to the privacy policy.
  expect(accountSectionPath("pt", "privacy", "deletion")).toBe("/pt/data#deletion");
  expect(accountSectionPath("pt", "privacy")).toBe("/pt/data");
  expect(accountAreaOfPath("/pt/data")).toBe("privacy");
  expect(accountAreaOfPath("/pt/privacy")).toBeUndefined();
  expect(accountSectionPath("en", "overview")).toBe("/en");
  expect(accountSectionPath("en", "overview", "summary")).toBe("/en");
  expect(isAccountSection("administration", "bans")).toBe(true);
  expect(isAccountSection("privacy", "bans")).toBe(true);
  expect(isAccountSection("security", "picture")).toBe(false);
  expect(isAccountSection("overview", "summary")).toBe(false);
  expect(isAccountSection("nowhere", "summary")).toBe(false);
  expect(accountAreaOfPath("/en")).toBe("overview");
  expect(accountAreaOfPath("/pt/security")).toBe("security");
  expect(accountAreaOfPath("/pt/security/devices")).toBe("security");
  expect(accountAreaOfPath("/en/rules")).toBeUndefined();
});
