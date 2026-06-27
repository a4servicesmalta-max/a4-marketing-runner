import { describe, it, expect, vi } from "vitest";
import { requireSecret } from "./auth.js";

function mockRes() {
  return { statusCode: 0, body: undefined as unknown,
    status(c: number) { this.statusCode = c; return this; },
    json(b: unknown) { this.body = b; return this; } };
}

describe("requireSecret", () => {
  const mw = requireSecret("super-secret-value-1234");

  it("rejects a missing header with 401", () => {
    const res = mockRes(); const next = vi.fn();
    mw({ headers: {} } as any, res as any, next as any);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret with 401", () => {
    const res = mockRes(); const next = vi.fn();
    mw({ headers: { "x-runner-secret": "wrong" } } as any, res as any, next as any);
    expect(res.statusCode).toBe(401);
  });

  it("calls next on a correct secret", () => {
    const res = mockRes(); const next = vi.fn();
    mw({ headers: { "x-runner-secret": "super-secret-value-1234" } } as any, res as any, next as any);
    expect(next).toHaveBeenCalledOnce();
  });
});
