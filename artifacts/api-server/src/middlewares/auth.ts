import type { Request, Response, NextFunction } from "express";

const ANONYMOUS_USER_ID = "anonymous";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  (req as any).userId = ANONYMOUS_USER_ID;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  (req as any).userId = ANONYMOUS_USER_ID;
  next();
}
