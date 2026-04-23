import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

const CLERK_BASE = "https://api.clerk.com/v1";

async function fetchUserRole(userId: string): Promise<string | null> {
  try {
    const r = await fetch(`${CLERK_BASE}/users/${userId}`, {
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    });
    if (!r.ok) return null;
    const user = await r.json();
    return user?.public_metadata?.role ?? null;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });
    return;
  }
  (req as any).userId = userId;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "يجب تسجيل الدخول أولاً" });
    return;
  }

  // Check session claims first (fast path)
  const claimsRole =
    (auth?.sessionClaims as any)?.metadata?.role ??
    (auth?.sessionClaims as any)?.publicMetadata?.role;

  if (claimsRole === "admin") {
    (req as any).userId = userId;
    next();
    return;
  }

  // Fallback: verify via Clerk Backend API (handles cases where JWT doesn't include metadata)
  const role = await fetchUserRole(userId);
  if (role !== "admin") {
    res.status(403).json({ error: "غير مصرح — هذه الصفحة للمسؤولين فقط" });
    return;
  }

  (req as any).userId = userId;
  next();
}
