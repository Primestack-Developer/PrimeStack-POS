import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "primestack-jwt-secret-change-in-production";

export function generateToken(email: string): string {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: "12h" });
}

export function verifyToken(token: string): { email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { email: string };
  } catch {
    return null;
  }
}

// Express middleware — protects all dashboard API routes
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized — no token" });
    return;
  }

  const token   = authHeader.split(" ")[1];
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: "Unauthorized — invalid or expired token" });
    return;
  }

  (req as any).admin = payload;
  next();
}
