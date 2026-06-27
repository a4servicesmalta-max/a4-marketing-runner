import { describe, it, expect } from "vitest";
import { getEmployee, listEmployees } from "./employees.js";

describe("employees", () => {
  it("lists 7 employees", () => {
    expect(listEmployees()).toHaveLength(7);
  });
  it("finds a known employee by id", () => {
    expect(getEmployee("demand-gen")?.title).toBe("Demand Gen / Sales-aligned");
  });
  it("returns undefined for an unknown id", () => {
    expect(getEmployee("nope")).toBeUndefined();
  });
});
