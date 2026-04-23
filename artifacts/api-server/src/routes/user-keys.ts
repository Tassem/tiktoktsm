import { Router } from "express";
import { db, userApiKeysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getAuth } from "@clerk/express";

const router = Router();

// GET all key types for current user (returns masked keys)
router.get("/", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  try {
    const rows = await db
      .select({
        keyType: userApiKeysTable.keyType,
        maskedKey: userApiKeysTable.encryptedKey,
      })
      .from(userApiKeysTable)
      .where(eq(userApiKeysTable.userId, userId));

    const result: Record<string, string> = {};
    for (const row of rows) {
      // Mask key: show first 4 + last 4
      const k = row.maskedKey;
      result[row.keyType] = k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : "****";
    }
    res.json({ keys: result });
  } catch (err) {
    res.status(500).json({ error: "فشل جلب المفاتيح" });
  }
});

// PUT upsert a key for current user
router.put("/:keyType", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const { keyType } = req.params;
  const { apiKey } = req.body as { apiKey?: string };

  const VALID_TYPES = ["openai", "fal", "bfl", "google", "anthropic"];
  if (!VALID_TYPES.includes(keyType)) {
    res.status(400).json({ error: "نوع المفتاح غير صالح" });
    return;
  }
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 8) {
    res.status(400).json({ error: "المفتاح قصير جداً" });
    return;
  }

  try {
    const existing = await db
      .select({ id: userApiKeysTable.id })
      .from(userApiKeysTable)
      .where(and(eq(userApiKeysTable.userId, userId), eq(userApiKeysTable.keyType, keyType)));

    if (existing.length > 0) {
      await db
        .update(userApiKeysTable)
        .set({ encryptedKey: apiKey.trim() })
        .where(and(eq(userApiKeysTable.userId, userId), eq(userApiKeysTable.keyType, keyType)));
    } else {
      await db.insert(userApiKeysTable).values({
        userId,
        keyType,
        encryptedKey: apiKey.trim(),
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "فشل حفظ المفتاح" });
  }
});

// DELETE a key
router.delete("/:keyType", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const { keyType } = req.params;
  try {
    await db
      .delete(userApiKeysTable)
      .where(and(eq(userApiKeysTable.userId, userId), eq(userApiKeysTable.keyType, keyType)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "فشل حذف المفتاح" });
  }
});

// Internal helper: get raw key for a user (used by other routes)
export async function getUserKey(userId: string, keyType: string): Promise<string | null> {
  const rows = await db
    .select({ encryptedKey: userApiKeysTable.encryptedKey })
    .from(userApiKeysTable)
    .where(and(eq(userApiKeysTable.userId, userId), eq(userApiKeysTable.keyType, keyType)));
  return rows[0]?.encryptedKey ?? null;
}

// GET /me — current user info + role from Clerk session claims
router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId ?? "";
  const sessionClaims = auth?.sessionClaims as any;
  const role =
    sessionClaims?.metadata?.role ??
    sessionClaims?.publicMetadata?.role ??
    "member";
  res.json({ userId, role });
});

export default router;
