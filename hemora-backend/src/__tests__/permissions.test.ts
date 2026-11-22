/**
 * Tests for the permission statements and role definitions.
 * Imports directly from src/lib/permissions.ts.
 */

import { statement, roles } from "../lib/permissions";

describe("permission statements", () => {
  it("defines all expected resource categories", () => {
    expect(Object.keys(statement)).toEqual(
      expect.arrayContaining([
        "inventory",
        "requisition",
        "transfusion",
        "forecast",
        "campaign",
        "user",
      ])
    );
  });

  it("defines correct permissions for inventory", () => {
    expect(statement.inventory).toEqual(
      expect.arrayContaining(["read", "update", "dispatch"])
    );
  });

  it("defines correct permissions for requisition", () => {
    expect(statement.requisition).toEqual(
      expect.arrayContaining(["create", "read", "approve", "reject"])
    );
  });

  it("defines correct permissions for user management", () => {
    expect(statement.user).toEqual(
      expect.arrayContaining(["create", "list", "set-role", "ban", "delete"])
    );
  });

  it("defines correct permissions for transfusion", () => {
    expect(statement.transfusion).toEqual(
      expect.arrayContaining(["create", "read"])
    );
  });

  it("defines correct permissions for forecast", () => {
    expect(statement.forecast).toEqual(
      expect.arrayContaining(["view", "trigger"])
    );
  });

  it("defines correct permissions for campaign", () => {
    expect(statement.campaign).toEqual(
      expect.arrayContaining(["create", "read"])
    );
  });
});

describe("role permission hierarchy", () => {
  it("exports all expected roles", () => {
    expect(Object.keys(roles)).toEqual(
      expect.arrayContaining([
        "DONOR",
        "NURSE",
        "DOCTOR",
        "MANAGER",
        "ADMIN",
      ])
    );
  });

  it("DONOR role exists", () => {
    expect(roles.DONOR).toBeDefined();
  });

  it("ADMIN role exists", () => {
    expect(roles.ADMIN).toBeDefined();
  });

  it("all five roles are defined", () => {
    expect(Object.keys(roles)).toHaveLength(5);
  });
});
