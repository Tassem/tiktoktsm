import { Router } from "express";
import {
  db,
  aiProvidersTable,
  aiProviderModelsTable,
  aiServiceAssignmentsTable,
} from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { z } from "zod";

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

const providerSchema = z.object({
  type: z.enum(["openrouter", "custom"]),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

const modelSchema = z.object({
  modelId: z.string().min(1),
  label: z.string().min(1),
  capabilities: z.string().optional().default("analysis"),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

const assignmentSchema = z.object({
  serviceName: z.string().min(1),
  modelId: z.number().int().nullable(),
});

// ─── Providers CRUD (Admin only) ─────────────────────────────────────────────

// GET /api/ai-providers - list all providers with their models
router.get("/ai-providers", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  try {
    const providers = await db
      .select()
      .from(aiProvidersTable)
      .orderBy(asc(aiProvidersTable.sortOrder), asc(aiProvidersTable.createdAt));

    const models = await db
      .select()
      .from(aiProviderModelsTable)
      .orderBy(asc(aiProviderModelsTable.sortOrder), asc(aiProviderModelsTable.createdAt));

    const result = providers.map((p) => ({
      ...p,
      apiKey: p.apiKey ? `${p.apiKey.slice(0, 4)}...${p.apiKey.slice(-4)}` : "",
      models: models.filter((m) => m.providerId === p.id),
    }));

    res.json({ providers: result });
  } catch {
    res.status(500).json({ error: "فشل جلب مزودي الذكاء الاصطناعي" });
  }
});

// POST /api/ai-providers - create provider
router.post("/ai-providers", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = providerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" });
    return;
  }
  try {
    const [provider] = await db
      .insert(aiProvidersTable)
      .values(parsed.data)
      .returning();
    res.json({ provider: { ...provider, apiKey: "****" } });
  } catch {
    res.status(500).json({ error: "فشل إنشاء المزود" });
  }
});

// PUT /api/ai-providers/:id - update provider
router.put("/ai-providers/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }

  const parsed = providerSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" });
    return;
  }

  // If apiKey is a masked value (contains ...) don't update it
  const data = { ...parsed.data };
  if (data.apiKey && data.apiKey.includes("...")) {
    delete data.apiKey;
  }

  try {
    const [updated] = await db
      .update(aiProvidersTable)
      .set(data)
      .where(eq(aiProvidersTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "المزود غير موجود" }); return; }
    res.json({ provider: { ...updated, apiKey: "****" } });
  } catch {
    res.status(500).json({ error: "فشل تحديث المزود" });
  }
});

// DELETE /api/ai-providers/:id - delete provider (cascades models)
router.delete("/ai-providers/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }
  try {
    await db.delete(aiProvidersTable).where(eq(aiProvidersTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "فشل حذف المزود" });
  }
});

// ─── Models CRUD ─────────────────────────────────────────────────────────────

// POST /api/ai-providers/:id/models - add model to provider
router.post("/ai-providers/:id/models", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const providerId = parseInt(req.params.id);
  if (isNaN(providerId)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }

  const parsed = modelSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" });
    return;
  }

  try {
    const [model] = await db
      .insert(aiProviderModelsTable)
      .values({ ...parsed.data, providerId })
      .returning();
    res.json({ model });
  } catch {
    res.status(500).json({ error: "فشل إضافة الموديل" });
  }
});

// PUT /api/ai-providers/models/:modelId - update model
router.put("/ai-providers/models/:modelId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const modelId = parseInt(req.params.modelId);
  if (isNaN(modelId)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }

  const parsed = modelSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" });
    return;
  }

  try {
    const [updated] = await db
      .update(aiProviderModelsTable)
      .set(parsed.data)
      .where(eq(aiProviderModelsTable.id, modelId))
      .returning();
    if (!updated) { res.status(404).json({ error: "الموديل غير موجود" }); return; }
    res.json({ model: updated });
  } catch {
    res.status(500).json({ error: "فشل تحديث الموديل" });
  }
});

// DELETE /api/ai-providers/models/:modelId - delete model
router.delete("/ai-providers/models/:modelId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const modelId = parseInt(req.params.modelId);
  if (isNaN(modelId)) { res.status(400).json({ error: "معرّف غير صالح" }); return; }
  try {
    await db.delete(aiProviderModelsTable).where(eq(aiProviderModelsTable.id, modelId));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "فشل حذف الموديل" });
  }
});

// ─── Service Assignments ──────────────────────────────────────────────────────

const SERVICES = [
  { key: "video-analysis", label: "تحليل الفيديو (Reel Analysis)", description: "يحتاج موديل يدعم الصور/الفيديو (Vision)" },
  { key: "remix", label: "ريميكس القصص (Remix Studio)", description: "موديل نصي قوي لإعادة كتابة القصص" },
  { key: "story-summary", label: "ملخص القصة بالعربية", description: "موديل نصي لتوليد الملخصات بالدارجة" },
  { key: "image-generation", label: "توليد الصور", description: "موديل متخصص في توليد الصور (إن دعمه المزود)" },
];

// GET /api/ai-service-assignments - get all service assignments with model info
router.get("/ai-service-assignments", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  try {
    const assignments = await db.select().from(aiServiceAssignmentsTable);
    const models = await db
      .select({
        id: aiProviderModelsTable.id,
        modelId: aiProviderModelsTable.modelId,
        label: aiProviderModelsTable.label,
        capabilities: aiProviderModelsTable.capabilities,
        providerId: aiProviderModelsTable.providerId,
        providerName: aiProvidersTable.name,
        providerType: aiProvidersTable.type,
        providerBaseUrl: aiProvidersTable.baseUrl,
        isActive: aiProvidersTable.isActive,
      })
      .from(aiProviderModelsTable)
      .innerJoin(aiProvidersTable, eq(aiProviderModelsTable.providerId, aiProvidersTable.id))
      .where(eq(aiProvidersTable.isActive, true));

    const result = SERVICES.map((svc) => {
      const assignment = assignments.find((a) => a.serviceName === svc.key);
      const model = assignment?.modelId ? models.find((m) => m.id === assignment.modelId) : null;
      return {
        ...svc,
        assignedModelId: assignment?.modelId ?? null,
        assignedModel: model ?? null,
      };
    });

    res.json({ services: result, availableModels: models });
  } catch {
    res.status(500).json({ error: "فشل جلب تعيينات الخدمات" });
  }
});

// PUT /api/ai-service-assignments - bulk update assignments
router.put("/ai-service-assignments", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = z.array(assignmentSchema).safeParse(req.body?.assignments);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صالحة" });
    return;
  }

  try {
    for (const a of parsed.data) {
      const existing = await db
        .select({ id: aiServiceAssignmentsTable.id })
        .from(aiServiceAssignmentsTable)
        .where(eq(aiServiceAssignmentsTable.serviceName, a.serviceName));

      if (existing.length > 0) {
        await db
          .update(aiServiceAssignmentsTable)
          .set({ modelId: a.modelId })
          .where(eq(aiServiceAssignmentsTable.serviceName, a.serviceName));
      } else {
        await db
          .insert(aiServiceAssignmentsTable)
          .values({ serviceName: a.serviceName, modelId: a.modelId });
      }
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "فشل تحديث تعيينات الخدمات" });
  }
});

// ─── Public: get resolved model for a service (used by prompt generator) ─────

export async function getServiceModel(serviceName: string): Promise<{
  baseUrl: string;
  apiKey: string;
  modelId: string;
} | null> {
  try {
    const [assignment] = await db
      .select()
      .from(aiServiceAssignmentsTable)
      .where(eq(aiServiceAssignmentsTable.serviceName, serviceName));

    if (!assignment?.modelId) return null;

    const [row] = await db
      .select({
        modelId: aiProviderModelsTable.modelId,
        baseUrl: aiProvidersTable.baseUrl,
        apiKey: aiProvidersTable.apiKey,
        isActive: aiProvidersTable.isActive,
      })
      .from(aiProviderModelsTable)
      .innerJoin(aiProvidersTable, eq(aiProviderModelsTable.providerId, aiProvidersTable.id))
      .where(
        and(
          eq(aiProviderModelsTable.id, assignment.modelId),
          eq(aiProvidersTable.isActive, true)
        )
      );

    if (!row) return null;

    return {
      baseUrl: row.baseUrl,
      apiKey: row.apiKey,
      modelId: row.modelId,
    };
  } catch {
    return null;
  }
}

export default router;
