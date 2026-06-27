import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function requireSecret(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const got = req.headers["x-runner-secret"];
    if (typeof got !== "string" || !safeEqual(got, secret)) {
      return res.status(401).json({ error: "unauthorized" });
    }
    next();
  };
}
