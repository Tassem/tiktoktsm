import { Router, type IRouter } from "express";
import { and, count, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  CreateAnalysisBody,
  CreateNicheBody,
  DeleteNicheParams,
  DeletePromptPackParams,
  GetDashboardSummaryResponse,
  GetNicheParams,
  GetNicheResponse,
  GetPromptPackParams,
  GetPromptPackResponse,
  GetProviderSettingsResponse,
  ListAnalysesQueryParams,
  ListAnalysesResponse,
  ListNichesResponse,
  ListPromptPacksQueryParams,
  ListPromptPacksResponse,
  ListRecentActivityResponse,
  RemixPromptPackBody,
  RemixPromptPackParams,
  UpdatePromptPackBody,
  UpdatePromptPackParams,
  UpdatePromptPackResponse,
  UpdateNicheBody,
  UpdateNicheParams,
  UpdateNicheResponse,
  UpdateProviderSettingsBody,
  UpdateProviderSettingsResponse,
} from "@workspace/api-zod";
import {
  db,
  nichesTable,
  promptPacksTable,
  providerSettingsTable,
  reelAnalysesTable,
  scenePromptsTable,
  aiSystemPromptsTable,
  type Niche,
  type PromptPack,
  type ProviderSettings,
} from "@workspace/db";
import { buildAIVideoPromptPack, buildAIUrlOnlyPromptPack, buildDemoPromptPack, buildRemixPromptPack } from "../lib/prompt-generator";
import { loadSystemPrompt, ensureAllSystemPromptsSeeded, syncDefaultSystemPrompts, DEFAULT_SYSTEM_PROMPTS } from "../lib/ai-system-prompts";
import { getServiceModel } from "./ai-providers";

const router: IRouter = Router();
let seedDataPromise: Promise<void> | undefined;

function lastFour(value: string): string {
  return value.trim().slice(-4);
}

function serializeProvider(settings: ProviderSettings) {
  return {
    id: settings.id,
    providerName: settings.providerName,
    model: settings.model,
    baseUrl: settings.baseUrl,
    apiKeyConfigured: settings.apiKeyConfigured,
    apiKeyLastFour: settings.apiKeyLastFour,
    realAnalysisEnabled: settings.realAnalysisEnabled,
    updatedAt: settings.updatedAt,
  };
}

async function ensureProviderSettings(): Promise<ProviderSettings> {
  const [existing] = await db
    .select()
    .from(providerSettingsTable)
    .orderBy(providerSettingsTable.id)
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(providerSettingsTable)
    .values({
      providerName: "OpenAI compatible",
      model: "gpt-4o",
      baseUrl: null,
      apiKeyConfigured: false,
      apiKeyLastFour: null,
      realAnalysisEnabled: false,
    })
    .returning();

  return created;
}

async function seedDataOnce(): Promise<void> {
  await ensureProviderSettings();
  await syncDefaultSystemPrompts().catch(() => {});
}

async function ensureSeedData(): Promise<void> {
  seedDataPromise ??= seedDataOnce();
  await seedDataPromise;
}

function notFound(message: string) {
  return { error: message };
}

function uid(req: Parameters<typeof getAuth>[0]): string | null {
  return getAuth(req)?.userId ?? null;
}

async function findNiche(nicheId: number, userId: string): Promise<Niche | undefined> {
  const [niche] = await db
    .select()
    .from(nichesTable)
    .where(and(eq(nichesTable.id, nicheId), eq(nichesTable.userId, userId)));
  return niche;
}

async function promptPackSummary(pack: PromptPack) {
  const [niche] = pack.nicheId
    ? await db.select().from(nichesTable).where(eq(nichesTable.id, pack.nicheId))
    : [];
  const [{ value: sceneCount }] = await db
    .select({ value: count() })
    .from(scenePromptsTable)
    .where(eq(scenePromptsTable.promptPackId, pack.id));
  const [analysis] = await db
    .select({ summaryPrompt: reelAnalysesTable.summaryPrompt, sourceType: reelAnalysesTable.sourceType })
    .from(reelAnalysesTable)
    .where(eq(reelAnalysesTable.id, pack.analysisId));

  const sourceType = (analysis?.sourceType === "remix" ? "remix" : "original") as "original" | "remix";

  return {
    id: pack.id,
    nicheId: pack.nicheId,
    nicheName: niche?.name ?? "Deleted niche",
    analysisId: pack.analysisId,
    title: pack.title,
    concept: pack.concept,
    summaryPrompt: analysis?.summaryPrompt ?? null,
    sceneCount,
    createdAt: pack.createdAt,
    sourceType,
  };
}

router.get("/niches", async (req, res): Promise<void> => {
  await ensureSeedData();
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const niches = await db
    .select()
    .from(nichesTable)
    .where(eq(nichesTable.userId, userId))
    .orderBy(desc(nichesTable.updatedAt));
  res.json(ListNichesResponse.parse(niches));
});

router.post("/niches", async (req, res): Promise<void> => {
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = CreateNicheBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid niche create body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [niche] = await db.insert(nichesTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(GetNicheResponse.parse(niche));
});

router.get("/niches/:nicheId", async (req, res): Promise<void> => {
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = GetNicheParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const niche = await findNiche(params.data.nicheId, userId);
  if (!niche) {
    res.status(404).json(notFound("Niche not found"));
    return;
  }

  res.json(GetNicheResponse.parse(niche));
});

router.patch("/niches/:nicheId", async (req, res): Promise<void> => {
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = UpdateNicheParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateNicheBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [niche] = await db
    .update(nichesTable)
    .set(parsed.data)
    .where(and(eq(nichesTable.id, params.data.nicheId), eq(nichesTable.userId, userId)))
    .returning();

  if (!niche) {
    res.status(404).json(notFound("Niche not found"));
    return;
  }

  res.json(UpdateNicheResponse.parse(niche));
});

router.delete("/niches/:nicheId", async (req, res): Promise<void> => {
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = DeleteNicheParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(nichesTable)
    .where(and(eq(nichesTable.id, params.data.nicheId), eq(nichesTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json(notFound("Niche not found"));
    return;
  }

  res.sendStatus(204);
});

router.get("/provider-settings", async (_req, res): Promise<void> => {
  const settings = await ensureProviderSettings();

  // Check if real AI is available via: Replit AI env vars OR new DB service assignments
  const hasReplitAI = !!(
    process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] &&
    process.env["AI_INTEGRATIONS_OPENAI_API_KEY"]
  );
  const dbModel = await getServiceModel("video-analysis");
  const hasRealAI = hasReplitAI || !!dbModel;

  const serialized = serializeProvider(settings);
  if (hasRealAI) {
    serialized.realAnalysisEnabled = true;
  }

  res.json(GetProviderSettingsResponse.parse(serialized));
});

router.put("/provider-settings", async (req, res): Promise<void> => {
  const parsed = UpdateProviderSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await ensureProviderSettings();
  const apiKey = parsed.data.apiKey?.trim();
  const update = {
    providerName: parsed.data.providerName,
    model: parsed.data.model,
    baseUrl: parsed.data.baseUrl?.trim() || null,
    apiKeyConfigured: parsed.data.clearApiKey ? false : apiKey ? true : existing.apiKeyConfigured,
    apiKeyLastFour: parsed.data.clearApiKey ? null : apiKey ? lastFour(apiKey) : existing.apiKeyLastFour,
    realAnalysisEnabled: false,
  };

  const [settings] = await db
    .update(providerSettingsTable)
    .set(update)
    .where(eq(providerSettingsTable.id, existing.id))
    .returning();

  res.json(UpdateProviderSettingsResponse.parse(serializeProvider(settings)));
});

router.get("/analyses", async (req, res): Promise<void> => {
  await ensureSeedData();
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const query = ListAnalysesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [eq(reelAnalysesTable.userId, userId)];
  if (query.data.nicheId) conditions.push(eq(reelAnalysesTable.nicheId, query.data.nicheId));

  const rows = await db
    .select({ analysis: reelAnalysesTable, niche: nichesTable })
    .from(reelAnalysesTable)
    .leftJoin(nichesTable, isNotNull(reelAnalysesTable.nicheId) ? eq(reelAnalysesTable.nicheId, nichesTable.id) : undefined)
    .where(and(...conditions))
    .orderBy(desc(reelAnalysesTable.createdAt));

  res.json(
    ListAnalysesResponse.parse(
      rows.map(({ analysis, niche }) => ({
        ...analysis,
        status: analysis.status as "completed" | "failed",
        providerMode: analysis.providerMode as "demo" | "provider",
        nicheName: niche?.name ?? "Deleted niche",
      })),
    ),
  );
});

router.post("/analyses", async (req, res): Promise<void> => {
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = CreateAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const niche = await findNiche(parsed.data.nicheId, userId);
  if (!niche) {
    res.status(404).json(notFound("Niche not found"));
    return;
  }

  const videoFrames = parsed.data.videoFrames ?? [];
  const reelUrl = parsed.data.reelUrl?.trim() ?? "";

  if (videoFrames.length === 0 && !reelUrl) {
    res.status(422).json({
      error: "Upload a video file or provide a reel URL to analyze.",
      details: "The app needs either extracted video frames (for full analysis) or a reel URL with notes (for concept-based generation).",
    });
    return;
  }

  // Check if a real AI model is configured for video-analysis
  const configuredModel = await getServiceModel("video-analysis");
  const hasRealAI = !!configuredModel ||
    !!(process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] && process.env["AI_INTEGRATIONS_OPENAI_API_KEY"]);

  // Use demo mode if: explicitly requested OR no AI is configured
  const useDemo = parsed.data.demoMode || !hasRealAI;

  let generated: ReturnType<typeof buildDemoPromptPack>;
  let usedProviderMode: "demo" | "provider" = useDemo ? "demo" : "provider";

  try {
    if (useDemo) {
      generated = buildDemoPromptPack({
        niche,
        concept: parsed.data.concept,
        reelNotes: parsed.data.reelNotes,
      });
    } else {
      const videoSystem = await loadSystemPrompt("video-analysis", { withModel: true }).catch(() => null);
      if (videoFrames.length > 0) {
        generated = await buildAIVideoPromptPack({
          niche,
          concept: parsed.data.concept,
          reelNotes: parsed.data.reelNotes,
          videoFrames,
          videoDataUrl: parsed.data.videoDataUrl,
          systemPromptOverride: videoSystem?.systemPrompt,
          modelOverride: videoSystem?.modelOverride,
        });
      } else {
        generated = await buildAIUrlOnlyPromptPack({
          niche,
          concept: parsed.data.concept,
          reelUrl,
          reelNotes: parsed.data.reelNotes,
          systemPromptOverride: videoSystem?.systemPrompt,
          modelOverride: videoSystem?.modelOverride,
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI video analysis failed.";
    req.log.error({ err: error }, "AI video analysis failed");
    res.status(502).json({
      error: "AI video analysis failed.",
      details: message,
    });
    return;
  }

  const [analysis] = await db
    .insert(reelAnalysesTable)
    .values({
      userId,
      nicheId: niche.id,
      reelUrl: parsed.data.reelUrl?.trim() || null,
      reelNotes: parsed.data.reelNotes,
      concept: parsed.data.concept,
      status: "completed",
      summaryPrompt: generated.summaryPrompt,
      providerMode: usedProviderMode,
    })
    .returning();

  const [pack] = await db
    .insert(promptPacksTable)
    .values({
      userId,
      nicheId: niche.id,
      analysisId: analysis.id,
      title: generated.title,
      concept: parsed.data.concept,
    })
    .returning();

  const scenes = await db
    .insert(scenePromptsTable)
    .values(generated.scenes.map((scene) => ({ ...scene, promptPackId: pack.id })))
    .returning();

  const summary = await promptPackSummary(pack);
  res.status(201).json({
    analysis: {
      ...analysis,
      nicheName: niche.name,
      status: analysis.status as "completed" | "failed",
      providerMode: analysis.providerMode as "demo" | "provider",
    },
    promptPack: GetPromptPackResponse.parse({ ...summary, scenes }),
  });
});

router.get("/prompt-packs", async (req, res): Promise<void> => {
  await ensureSeedData();
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const query = ListPromptPacksQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions: ReturnType<typeof eq>[] = [eq(promptPacksTable.userId, userId)];
  if (query.data.nicheId) conditions.push(eq(promptPacksTable.nicheId, query.data.nicheId));
  if (query.data.sourceType) conditions.push(eq(reelAnalysesTable.sourceType, query.data.sourceType));

  const packs = await db
    .select({ pack: promptPacksTable })
    .from(promptPacksTable)
    .innerJoin(reelAnalysesTable, eq(promptPacksTable.analysisId, reelAnalysesTable.id))
    .where(and(...conditions))
    .orderBy(desc(promptPacksTable.createdAt))
    .limit(query.data.limit ?? 50)
    .offset(query.data.offset ?? 0)
    .then((rows) => rows.map((r) => r.pack));

  res.json(ListPromptPacksResponse.parse(await Promise.all(packs.map(promptPackSummary))));
});

router.get("/prompt-packs/:promptPackId", async (req, res): Promise<void> => {
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = GetPromptPackParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [pack] = await db.select().from(promptPacksTable).where(and(eq(promptPacksTable.id, params.data.promptPackId), eq(promptPacksTable.userId, userId)));
  if (!pack) {
    res.status(404).json(notFound("Prompt pack not found"));
    return;
  }

  const scenes = await db
    .select()
    .from(scenePromptsTable)
    .where(eq(scenePromptsTable.promptPackId, pack.id))
    .orderBy(scenePromptsTable.sceneNumber);

  const summary = await promptPackSummary(pack);
  res.json(GetPromptPackResponse.parse({ ...summary, scenes }));
});

router.patch("/prompt-packs/:promptPackId", async (req, res): Promise<void> => {
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = UpdatePromptPackParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePromptPackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const niche = await findNiche(parsed.data.nicheId, userId);
  if (!niche) {
    res.status(404).json(notFound("Niche not found"));
    return;
  }

  const [pack] = await db
    .update(promptPacksTable)
    .set({ nicheId: niche.id })
    .where(and(eq(promptPacksTable.id, params.data.promptPackId), eq(promptPacksTable.userId, userId)))
    .returning();

  if (!pack) {
    res.status(404).json(notFound("Prompt pack not found"));
    return;
  }

  await db.update(reelAnalysesTable).set({ nicheId: niche.id }).where(eq(reelAnalysesTable.id, pack.analysisId));

  const scenes = await db
    .select()
    .from(scenePromptsTable)
    .where(eq(scenePromptsTable.promptPackId, pack.id))
    .orderBy(scenePromptsTable.sceneNumber);
  const summary = await promptPackSummary(pack);
  res.json(UpdatePromptPackResponse.parse({ ...summary, scenes }));
});

router.delete("/prompt-packs/:promptPackId", async (req, res): Promise<void> => {
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = DeletePromptPackParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(promptPacksTable)
    .where(and(eq(promptPacksTable.id, params.data.promptPackId), eq(promptPacksTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json(notFound("Prompt pack not found"));
    return;
  }

  res.sendStatus(204);
});

router.post("/prompt-packs/:promptPackId/remix", async (req, res): Promise<void> => {
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const params = RemixPromptPackParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = RemixPromptPackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [sourcePack] = await db.select().from(promptPacksTable).where(and(eq(promptPacksTable.id, params.data.promptPackId), eq(promptPacksTable.userId, userId)));
  if (!sourcePack) {
    res.status(404).json({ error: "Prompt pack not found" });
    return;
  }

  const [sourceAnalysis] = await db.select().from(reelAnalysesTable).where(eq(reelAnalysesTable.id, sourcePack.analysisId));

  const sourceScenes = await db
    .select()
    .from(scenePromptsTable)
    .where(eq(scenePromptsTable.promptPackId, sourcePack.id))
    .orderBy(scenePromptsTable.sceneNumber);

  const concept = parsed.data.concept?.trim() || `Remix: ${parsed.data.storyIdea.slice(0, 60)}`;

  let generated: Awaited<ReturnType<typeof buildRemixPromptPack>>;
  try {
    const remixSystem = await loadSystemPrompt("story-remix", { withModel: true }).catch(() => null);
    generated = await buildRemixPromptPack({
      originalTitle: sourcePack.title,
      originalSummaryPrompt: sourceAnalysis?.summaryPrompt ?? "",
      originalScenes: sourceScenes,
      storyIdea: parsed.data.storyIdea,
      concept,
      systemPromptOverride: remixSystem?.systemPrompt,
      modelOverride: remixSystem?.modelOverride,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI remix generation failed.";
    req.log.error({ err: error }, "AI remix generation failed");
    res.status(502).json({ error: "AI remix generation failed.", details: message });
    return;
  }

  const nicheId = parsed.data.nicheId ?? sourcePack.nicheId;

  const [newAnalysis] = await db
    .insert(reelAnalysesTable)
    .values({
      userId,
      nicheId: nicheId ?? null,
      reelUrl: null,
      reelNotes: `Remixed from pack #${sourcePack.id}: ${sourcePack.title}. Story: ${parsed.data.storyIdea}`,
      concept,
      status: "completed",
      summaryPrompt: generated.summaryPrompt,
      providerMode: "provider",
      sourceType: "remix",
    })
    .returning();

  const [newPack] = await db
    .insert(promptPacksTable)
    .values({
      userId,
      nicheId: nicheId ?? null,
      analysisId: newAnalysis.id,
      title: generated.title,
      concept,
    })
    .returning();

  const scenes = await db
    .insert(scenePromptsTable)
    .values(generated.scenes.map((scene) => ({ ...scene, promptPackId: newPack.id })))
    .returning();

  const summary = await promptPackSummary(newPack);
  res.status(201).json(GetPromptPackResponse.parse({ ...summary, scenes }));
});

router.get("/prompt-packs/:promptPackId/story-summary", async (req, res): Promise<void> => {
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const packId = parseInt(req.params["promptPackId"] ?? "");
  if (isNaN(packId)) { res.status(400).json({ error: "Invalid pack ID" }); return; }

  const forceRegenerate = req.query["force"] === "true";

  const [pack] = await db.select().from(promptPacksTable).where(and(eq(promptPacksTable.id, packId), eq(promptPacksTable.userId, userId)));
  if (!pack) { res.status(404).json({ error: "Prompt pack not found" }); return; }

  const scenes = await db
    .select()
    .from(scenePromptsTable)
    .where(eq(scenePromptsTable.promptPackId, packId))
    .orderBy(scenePromptsTable.sceneNumber);

  // Return cached data if available (and not forcing regeneration)
  if (!forceRegenerate && pack.storySummaryAr) {
    const sceneSummaries = scenes
      .filter((s) => s.sceneSummaryAr)
      .map((s) => ({ sceneNumber: s.sceneNumber, summary: s.sceneSummaryAr! }));
    res.json({ summary: pack.storySummaryAr, sceneSummaries, cached: true });
    return;
  }

  // Resolve AI credentials via new provider system, then env var fallback
  const summaryModel = await getServiceModel("story-summary");
  const baseUrl = summaryModel?.baseUrl ?? process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = summaryModel?.apiKey ?? process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  const modelId = summaryModel?.modelId ?? "gpt-5.2";
  if (!baseUrl || !apiKey) { res.status(503).json({ error: "لم يتم تكوين أي مزود ذكاء اصطناعي. أضف مزوداً في الإعدادات." }); return; }

  const scenesText = scenes
    .map((s) => `المشهد ${s.sceneNumber} — ${s.title}\nالصورة: ${s.imagePrompt.slice(0, 400)}\nالحوار: ${s.voiceOverDarija.slice(0, 400)}`)
    .join("\n\n────────────────────\n\n");

  const systemPromptText = await loadSystemPrompt("story-summary").catch(
    () => "أنت كاتب سيناريو محترف. لخّص القصة وكل مشهد بالدارجة المغربية. أجب بـ JSON فقط."
  );

  const aiResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPromptText },
        {
          role: "user",
          content: `عنوان الباك: ${pack.title}\nالفكرة: ${pack.concept}\n\n═══════════ المشاهد ═══════════\n\n${scenesText}\n\n═══════════════════════════════\n\nأرقام المشاهد: ${scenes.map((s) => s.sceneNumber).join(", ")}\n\nأجب بـ JSON:\n{\n  "summary": "الملخص الكامل...",\n  "sceneSummaries": [\n    { "sceneNumber": 1, "summary": "..." }\n  ]\n}`,
        },
      ],
      max_completion_tokens: 2000,
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    req.log.error({ status: aiResponse.status, body: errorText }, "AI story summary failed");
    res.status(502).json({ error: "AI summary generation failed." });
    return;
  }

  const aiJson = await aiResponse.json() as { choices?: Array<{ message?: { content?: string } }> };
  const rawContent = aiJson.choices?.[0]?.message?.content?.trim();
  if (!rawContent) { res.status(502).json({ error: "AI returned an empty summary." }); return; }

  let parsed: { summary?: string; sceneSummaries?: Array<{ sceneNumber: number; summary: string }> } = {};
  try { parsed = JSON.parse(rawContent) as typeof parsed; } catch { parsed = { summary: rawContent, sceneSummaries: [] }; }

  const storySummary = parsed.summary ?? rawContent;
  const sceneSummaries = Array.isArray(parsed.sceneSummaries) ? parsed.sceneSummaries : [];

  // Save to DB for future cached use
  await db.update(promptPacksTable).set({ storySummaryAr: storySummary }).where(eq(promptPacksTable.id, packId));
  for (const ss of sceneSummaries) {
    const scene = scenes.find((s) => s.sceneNumber === ss.sceneNumber);
    if (scene && ss.summary) {
      await db.update(scenePromptsTable).set({ sceneSummaryAr: ss.summary }).where(eq(scenePromptsTable.id, scene.id));
    }
  }

  res.json({ summary: storySummary, sceneSummaries, cached: false });
});

// ─── AI Systems Management ──────────────────────────────────────────────────

router.get("/ai-systems", async (_req, res): Promise<void> => {
  await ensureAllSystemPromptsSeeded().catch(() => {});

  const rows = await db.select().from(aiSystemPromptsTable).orderBy(aiSystemPromptsTable.id);

  // Fill in any missing systems from defaults (in case new ones were added)
  const result = Object.entries(DEFAULT_SYSTEM_PROMPTS).map(([key, defaults]) => {
    const row = rows.find((r) => r.systemKey === key);
    return {
      systemKey: key,
      displayName: row?.displayName ?? defaults.displayName,
      description: row?.description ?? defaults.description,
      systemPrompt: row?.systemPrompt ?? defaults.systemPrompt,
      modelOverride: row?.modelOverride ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  });

  res.json(result);
});

router.patch("/ai-systems/:systemKey", async (req, res): Promise<void> => {
  const { systemKey } = req.params as { systemKey: string };
  const body = req.body as { systemPrompt?: string; modelOverride?: string | null };

  if (!systemKey || !DEFAULT_SYSTEM_PROMPTS[systemKey]) {
    res.status(404).json({ error: "Unknown system key." });
    return;
  }
  if (body.systemPrompt !== undefined && body.systemPrompt.trim().length < 20) {
    res.status(400).json({ error: "systemPrompt must be at least 20 characters." });
    return;
  }

  await ensureAllSystemPromptsSeeded().catch(() => {});

  const [existing] = await db.select({ id: aiSystemPromptsTable.id, systemPrompt: aiSystemPromptsTable.systemPrompt }).from(aiSystemPromptsTable).where(eq(aiSystemPromptsTable.systemKey, systemKey));

  const updateFields: Record<string, unknown> = {};
  if (body.systemPrompt !== undefined) updateFields.systemPrompt = body.systemPrompt.trim();
  if ("modelOverride" in body) updateFields.modelOverride = body.modelOverride?.trim() || null;

  if (existing) {
    await db.update(aiSystemPromptsTable).set(updateFields).where(eq(aiSystemPromptsTable.systemKey, systemKey));
  } else {
    const defaults = DEFAULT_SYSTEM_PROMPTS[systemKey]!;
    await db.insert(aiSystemPromptsTable).values({
      systemKey,
      displayName: defaults.displayName,
      description: defaults.description,
      systemPrompt: (updateFields.systemPrompt as string | undefined) ?? defaults.systemPrompt,
      modelOverride: (updateFields.modelOverride as string | null | undefined) ?? null,
    });
  }

  res.json({ success: true, systemKey });
});

router.post("/ai-systems/:systemKey/reset", async (req, res): Promise<void> => {
  const { systemKey } = req.params as { systemKey: string };
  const defaults = DEFAULT_SYSTEM_PROMPTS[systemKey];
  if (!defaults) { res.status(404).json({ error: "Unknown system key." }); return; }

  await db.update(aiSystemPromptsTable).set({ systemPrompt: defaults.systemPrompt, modelOverride: null }).where(eq(aiSystemPromptsTable.systemKey, systemKey));
  res.json({ success: true, systemKey, systemPrompt: defaults.systemPrompt, modelOverride: null });
});

router.get("/dashboard-summary", async (req, res): Promise<void> => {
  await ensureSeedData();
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [nicheCount] = await db.select({ value: count() }).from(nichesTable).where(eq(nichesTable.userId, userId));
  const [promptPackCount] = await db.select({ value: count() }).from(promptPacksTable).where(eq(promptPacksTable.userId, userId));
  const [analysisCount] = await db.select({ value: count() }).from(reelAnalysesTable).where(eq(reelAnalysesTable.userId, userId));

  // sceneCount: count scenes belonging to user's packs
  const userPackIds = await db.select({ id: promptPacksTable.id }).from(promptPacksTable).where(eq(promptPacksTable.userId, userId));
  const packIds = userPackIds.map((r) => r.id);
  const sceneCount = packIds.length > 0
    ? (await db.select({ value: count() }).from(scenePromptsTable).where(inArray(scenePromptsTable.promptPackId, packIds)))[0]?.value ?? 0
    : 0;

  const [provider] = await db.select().from(providerSettingsTable).orderBy(providerSettingsTable.id).limit(1);
  const [lastPack] = await db.select().from(promptPacksTable).where(eq(promptPacksTable.userId, userId)).orderBy(desc(promptPacksTable.createdAt)).limit(1);

  res.json(
    GetDashboardSummaryResponse.parse({
      nicheCount: nicheCount.value,
      promptPackCount: promptPackCount.value,
      sceneCount,
      analysisCount: analysisCount.value,
      providerConfigured: provider?.apiKeyConfigured ?? false,
      lastPromptPackTitle: lastPack?.title ?? null,
    }),
  );
});

router.get("/recent-activity", async (req, res): Promise<void> => {
  await ensureSeedData();
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const niches = await db.select().from(nichesTable).where(eq(nichesTable.userId, userId)).orderBy(desc(nichesTable.createdAt)).limit(4);
  const analyses = await db
    .select({ analysis: reelAnalysesTable, niche: nichesTable })
    .from(reelAnalysesTable)
    .leftJoin(nichesTable, eq(reelAnalysesTable.nicheId, nichesTable.id))
    .where(eq(reelAnalysesTable.userId, userId))
    .orderBy(desc(reelAnalysesTable.createdAt))
    .limit(4);
  const packs = await db
    .select({ pack: promptPacksTable, niche: nichesTable })
    .from(promptPacksTable)
    .leftJoin(nichesTable, eq(promptPacksTable.nicheId, nichesTable.id))
    .where(eq(promptPacksTable.userId, userId))
    .orderBy(desc(promptPacksTable.createdAt))
    .limit(4);

  const activity = [
    ...niches.map((niche) => ({
      id: `niche-${niche.id}`,
      type: "niche" as const,
      title: `Niche workspace: ${niche.name}`,
      detail: niche.contentAngle,
      createdAt: niche.createdAt,
    })),
    ...analyses.map(({ analysis, niche }) => ({
      id: `analysis-${analysis.id}`,
      type: "analysis" as const,
      title: `Reel analyzed for ${niche?.name ?? "deleted niche"}`,
      detail: analysis.concept,
      createdAt: analysis.createdAt,
    })),
    ...packs.map(({ pack, niche }) => ({
      id: `prompt-pack-${pack.id}`,
      type: "prompt_pack" as const,
      title: pack.title,
      detail: `Saved under ${niche?.name ?? "deleted niche"}`,
      createdAt: pack.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 8);

  res.json(ListRecentActivityResponse.parse(activity));
});

export default router;
