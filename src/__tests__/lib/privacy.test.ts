import { describe, it, expect, afterEach } from "vitest";
import { PRIVACY_VERSION, getPrivacyOperator, needsConsent } from "@/lib/privacy";

describe("needsConsent", () => {
  it("asks anyone who hasn't agreed to the current version", () => {
    expect(needsConsent({ role: "OWNER", privacyVersion: null })).toBe(true);
    expect(needsConsent({ role: "TREASURER", privacyVersion: "2020-01-01" })).toBe(true);
    expect(needsConsent({ role: "ADMIN", privacyVersion: PRIVACY_VERSION })).toBe(false);
  });
  it("exempts the platform team", () => {
    expect(needsConsent({ role: "SUPER_ADMIN", privacyVersion: null })).toBe(false);
  });
});

describe("getPrivacyOperator", () => {
  const ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ENV };
  });
  it("falls back to generic wording without configuration", () => {
    delete process.env.PRIVACY_OPERATOR_NAME;
    delete process.env.PRIVACY_CONTACT_EMAIL;
    expect(getPrivacyOperator()).toMatchObject({ name: "the Society MS team", email: null, grievanceOfficer: null });
  });
  it("reads the contact details from the environment", () => {
    process.env.PRIVACY_OPERATOR_NAME = " Acme Pvt Ltd ";
    process.env.PRIVACY_CONTACT_EMAIL = "privacy@acme.example";
    process.env.PRIVACY_GRIEVANCE_OFFICER = "A. Person";
    expect(getPrivacyOperator()).toMatchObject({ name: "Acme Pvt Ltd", email: "privacy@acme.example", grievanceOfficer: "A. Person" });
  });
});
