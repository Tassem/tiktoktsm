import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { db, aiSystemPromptsTable } from "@workspace/db";
import { DEFAULT_SYSTEM_PROMPTS, ensureAllSystemPromptsSeeded } from "../lib/ai-system-prompts";

const router: IRouter = Router();

// GET /api/ai-systems — list all AI systems (seeds missing ones automatically)
router.get("/ai-systems", requireAdmin, async (_req, res) => {
  try {
    await ensureAllSystemPromptsSeeded();

    const rows = await db
      .select()
      .from(aiSystemPromptsTable)
      .orderBy(aiSystemPromptsTable.id);

    res.json(
      rows.map((r) => ({
        systemKey: r.systemKey,
        displayName: r.displayName,
        description: r.description,
        systemPrompt: r.systemPrompt,
        modelOverride: r.modelOverride,
        updatedAt: r.updatedAt?.toISOString() ?? null,
      }))
    );
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/ai-systems/:key — update system prompt and/or model override
router.patch("/ai-systems/:key", requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { systemPrompt, modelOverride } = req.body as {
      systemPrompt?: string;
      modelOverride?: string | null;
    };

    if (!Object.keys(DEFAULT_SYSTEM_PROMPTS).includes(key)) {
      res.status(404).json({ error: `نظام غير معروف: ${key}` });
      return;
    }

    if (systemPrompt !== undefined && systemPrompt.trim().length < 20) {
      res.status(400).json({ error: "الـ prompt قصير جداً (20 حرف على الأقل)" });
      return;
    }

    const existing = await db
      .select({ id: aiSystemPromptsTable.id })
      .from(aiSystemPromptsTable)
      .where(eq(aiSystemPromptsTable.systemKey, key));

    if (!existing.length) {
      await ensureAllSystemPromptsSeeded();
    }

    const updateData: Partial<typeof aiSystemPromptsTable.$inferInsert> = {};
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt.trim();
    if (modelOverride !== undefined) updateData.modelOverride = modelOverride || null;

    if (!Object.keys(updateData).length) {
      res.status(400).json({ error: "لا توجد بيانات للتحديث" });
      return;
    }

    const updated = await db
      .update(aiSystemPromptsTable)
      .set(updateData)
      .where(eq(aiSystemPromptsTable.systemKey, key))
      .returning();

    if (!updated.length) {
      res.status(404).json({ error: "النظام غير موجود" });
      return;
    }

    const r = updated[0];
    res.json({
      systemKey: r.systemKey,
      displayName: r.displayName,
      description: r.description,
      systemPrompt: r.systemPrompt,
      modelOverride: r.modelOverride,
      updatedAt: r.updatedAt?.toISOString() ?? null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/ai-systems/:key/reset — reset system prompt to default
router.post("/ai-systems/:key/reset", requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const defaults = DEFAULT_SYSTEM_PROMPTS[key];

    if (!defaults) {
      res.status(404).json({ error: `نظام غير معروف: ${key}` });
      return;
    }

    const updated = await db
      .update(aiSystemPromptsTable)
      .set({
        systemPrompt: defaults.systemPrompt,
        displayName: defaults.displayName,
        description: defaults.description,
        modelOverride: null,
      })
      .where(eq(aiSystemPromptsTable.systemKey, key))
      .returning();

    if (!updated.length) {
      await ensureAllSystemPromptsSeeded();
      const seeded = await db
        .select()
        .from(aiSystemPromptsTable)
        .where(eq(aiSystemPromptsTable.systemKey, key));

      if (!seeded.length) {
        res.status(500).json({ error: "فشل إعادة الضبط" });
        return;
      }

      const r = seeded[0];
      res.json({ systemPrompt: r.systemPrompt, modelOverride: r.modelOverride });
      return;
    }

    const r = updated[0];
    res.json({ systemPrompt: r.systemPrompt, modelOverride: r.modelOverride });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
