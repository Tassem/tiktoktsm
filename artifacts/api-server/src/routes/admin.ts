import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import * as path from "path";
import * as fs from "fs";
import archiver from "archiver";
import { requireAdmin, requireAuth } from "../middlewares/auth";
import { db, siteSettingsTable, announcementsTable } from "@workspace/db";
import { loadSystemPrompt } from "../lib/ai-system-prompts";
import { getUserKey } from "./user-keys";

const router: IRouter = Router();

const CLERK_BASE = "https://api.clerk.com/v1";
const clerkHeaders = () => ({
  Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
  "Content-Type": "application/json",
});

async function getOrCreateSiteSettings() {
  const rows = await db.select().from(siteSettingsTable).limit(1);
  if (rows.length > 0) return rows[0];
  const inserted = await db.insert(siteSettingsTable).values({}).returning();
  return inserted[0];
}

router.get("/admin/site-settings", requireAdmin, async (req, res) => {
  try {
    const settings = await getOrCreateSiteSettings();
    res.json(settings);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/admin/site-settings", requireAdmin, async (req, res) => {
  try {
    const {
      siteName, siteLocked, lockedMessage,
      registrationMode, inviteCode,
      contactEmail, contactTwitter, contactInstagram,
      contactWhatsapp, contactWebsite, footerText,
      announcementSliderDuration,
    } = req.body as Record<string, any>;

    const settings = await getOrCreateSiteSettings();
    const updated = await db
      .update(siteSettingsTable)
      .set({
        ...(siteName !== undefined && { siteName: String(siteName) }),
        ...(siteLocked !== undefined && { siteLocked: Boolean(siteLocked) }),
        ...(lockedMessage !== undefined && { lockedMessage: lockedMessage ? String(lockedMessage) : null }),
        ...(registrationMode !== undefined && { registrationMode: String(registrationMode) }),
        ...(inviteCode !== undefined && { inviteCode: inviteCode ? String(inviteCode) : null }),
        ...(contactEmail !== undefined && { contactEmail: contactEmail || null }),
        ...(contactTwitter !== undefined && { contactTwitter: contactTwitter || null }),
        ...(contactInstagram !== undefined && { contactInstagram: contactInstagram || null }),
        ...(contactWhatsapp !== undefined && { contactWhatsapp: contactWhatsapp || null }),
        ...(contactWebsite !== undefined && { contactWebsite: contactWebsite || null }),
        ...(footerText !== undefined && { footerText: footerText || null }),
        ...(announcementSliderDuration !== undefined && { announcementSliderDuration: Math.max(1, Math.min(60, Number(announcementSliderDuration))) }),
      })
      .where(eq(siteSettingsTable.id, settings.id))
      .returning();
    res.json(updated[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/public/site-settings", async (req, res) => {
  try {
    const settings = await getOrCreateSiteSettings();
    res.json({
      siteName: settings.siteName,
      siteLocked: settings.siteLocked,
      lockedMessage: settings.lockedMessage,
      registrationMode: settings.registrationMode,
      contactEmail: settings.contactEmail,
      contactTwitter: settings.contactTwitter,
      contactInstagram: settings.contactInstagram,
      contactWhatsapp: settings.contactWhatsapp,
      contactWebsite: settings.contactWebsite,
      footerText: settings.footerText,
      announcementSliderDuration: settings.announcementSliderDuration,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/public/validate-invite", async (req, res) => {
  try {
    const { code } = req.body as { code?: string };
    if (!code) { res.status(400).json({ valid: false }); return; }
    const settings = await getOrCreateSiteSettings();
    if (settings.registrationMode !== "invite") {
      res.json({ valid: true });
      return;
    }
    const valid = settings.inviteCode && settings.inviteCode === code.trim();
    res.json({ valid: Boolean(valid) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/admin/announcements", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(announcementsTable)
      .orderBy(announcementsTable.sortOrder, announcementsTable.createdAt);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/admin/announcements", requireAdmin, async (req, res) => {
  try {
    const {
      title, content, variant, placement, size,
      buttonText, buttonUrl, imageUrl, active, showTo, sortOrder,
    } = req.body as Record<string, any>;
    if (!content && !imageUrl) { res.status(400).json({ error: "المحتوى أو الصورة مطلوبان" }); return; }
    const inserted = await db.insert(announcementsTable).values({
      title: title || null,
      content: content ? String(content) : null,
      variant: variant || "info",
      placement: placement || "top",
      size: size || "md",
      buttonText: buttonText || null,
      buttonUrl: buttonUrl || null,
      imageUrl: imageUrl || null,
      active: active !== undefined ? Boolean(active) : true,
      showTo: showTo || "all",
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0,
    }).returning();
    res.json(inserted[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/admin/announcements/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      title, content, variant, placement, size,
      buttonText, buttonUrl, imageUrl, active, showTo, sortOrder,
    } = req.body as Record<string, any>;
    const updated = await db
      .update(announcementsTable)
      .set({
        ...(title !== undefined && { title: title || null }),
        ...(content !== undefined && { content: content || null }),
        ...(variant !== undefined && { variant: String(variant) }),
        ...(placement !== undefined && { placement: String(placement) }),
        ...(size !== undefined && { size: String(size) }),
        ...(buttonText !== undefined && { buttonText: buttonText || null }),
        ...(buttonUrl !== undefined && { buttonUrl: buttonUrl || null }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(active !== undefined && { active: Boolean(active) }),
        ...(showTo !== undefined && { showTo: String(showTo) }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
      })
      .where(eq(announcementsTable.id, id))
      .returning();
    if (!updated.length) { res.status(404).json({ error: "غير موجود" }); return; }
    res.json(updated[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/admin/announcements/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(announcementsTable).where(eq(announcementsTable.id, id));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/public/announcements", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(announcementsTable)
      .where(eq(announcementsTable.active, true))
      .orderBy(announcementsTable.sortOrder, announcementsTable.createdAt);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const query = req.query.q ? `&query=${encodeURIComponent(String(req.query.q))}` : "";
    const r = await fetch(`${CLERK_BASE}/users?limit=${limit}&offset=${offset}${query}`, {
      headers: clerkHeaders(),
    });
    const users = await r.json();
    res.json(users);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/admin/users/count", requireAdmin, async (req, res) => {
  try {
    const r = await fetch(`${CLERK_BASE}/users/count`, { headers: clerkHeaders() });
    const data = await r.json();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/admin/users/:id/role", requireAdmin, async (req, res) => {
  try {
    const { role } = req.body as { role?: string };
    const userId = req.params.id;
    const metadata = role && role !== "member" ? { role } : {};
    const r = await fetch(`${CLERK_BASE}/users/${userId}`, {
      method: "PATCH",
      headers: clerkHeaders(),
      body: JSON.stringify({ public_metadata: metadata }),
    });
    const data = await r.json();
    if (!r.ok) { res.status(r.status).json(data); return; }
    res.json({ id: data.id, metadata: data.public_metadata });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const r = await fetch(`${CLERK_BASE}/users/${userId}`, {
      method: "DELETE",
      headers: clerkHeaders(),
    });
    if (!r.ok) {
      const data = await r.json();
      res.status(r.status).json(data);
      return;
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/admin/users/:id/impersonate", requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const r = await fetch(`${CLERK_BASE}/users/${userId}/impersonation_tokens`, {
      method: "POST",
      headers: clerkHeaders(),
    });
    const data = await r.json();
    if (!r.ok) { res.status(r.status).json(data); return; }
    res.json({ token: data.token });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Dev Agent Chat ───────────────────────────────────────────────────────────

router.post("/admin/dev-agent/chat", requireAdmin, async (req, res) => {
  try {
    const { message, images, history, systemKey, previousOutput } = req.body as {
      message: string;
      images?: string[];
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      systemKey?: string;
      previousOutput?: string;
    };

    if (!message?.trim()) {
      res.status(400).json({ error: "الرسالة مطلوبة" });
      return;
    }

    const authCtx = getAuth(req);
    const userId = authCtx?.userId;

    const userApiKey = userId ? await getUserKey(userId, "openai").catch(() => null) : null;
    const baseUrl = userApiKey
      ? "https://api.openai.com/v1"
      : process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
    const apiKey = userApiKey ?? process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];

    if (!baseUrl || !apiKey) {
      res.status(503).json({ error: "يجب تهيئة مفتاح AI أولاً في إعدادات المستخدم." });
      return;
    }

    const devAgentSystem = await loadSystemPrompt("dev-agent", { withModel: true }).catch(() => null);
    const systemPromptText = devAgentSystem?.systemPrompt ??
      "You are an AI Prompt Engineering Consultant. Help the admin improve Video to Prompt and Remix Studio quality.";
    const modelOverride = devAgentSystem?.modelOverride;

    let contextSuffix = "";
    if (systemKey) {
      const targetPrompt = await loadSystemPrompt(systemKey).catch(() => null);
      if (targetPrompt) {
        const label = systemKey === "video-analysis" ? "Video to Prompt" : "Remix Studio";
        contextSuffix += `\n\n═══ CURRENT ${label.toUpperCase()} SYSTEM PROMPT ═══\n${targetPrompt}\n═══ END ═══`;
      }
    }
    if (previousOutput) {
      contextSuffix += `\n\n═══ PREVIOUS AI OUTPUT (for comparison) ═══\n${previousOutput}\n═══ END ═══`;
    }

    const fullSystem = systemPromptText + contextSuffix;

    const userContent: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> = [
      { type: "text", text: message },
    ];

    if (images && images.length > 0) {
      for (const img of images.slice(0, 8)) {
        userContent.push({
          type: "image_url",
          image_url: { url: img, detail: "high" },
        });
      }
    }

    const messages: Array<{ role: string; content: unknown }> = [
      { role: "system", content: fullSystem },
      ...(history ?? []).slice(-10).map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: images && images.length > 0 ? userContent : message },
    ];

    const aiRes = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelOverride ?? "gpt-4o",
        messages,
        max_completion_tokens: 3000,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      res.status(502).json({ error: `AI API error: ${errText.slice(0, 300)}` });
      return;
    }

    const aiJson = await aiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    const reply = aiJson.choices?.[0]?.message?.content?.trim();
    if (!reply) { res.status(502).json({ error: "AI returned empty response." }); return; }

    res.json({ reply });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Project ZIP Download ──────────────────────────────────────────────────────

router.get("/admin/download-project", requireAdmin, async (req, res) => {
  try {
    const projectRoot = path.resolve("/home/runner/workspace");

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="reel-prompt-studio.zip"`);

    const archive = archiver("zip", { zlib: { level: 6 } });

    archive.on("error", (err) => {
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });

    archive.pipe(res);

    archive.glob("**/*", {
      cwd: projectRoot,
      dot: true,
      ignore: [
        "**/node_modules/**",
        "**/.git/**",
        "**/.local/**",
        "**/dist/**",
        "**/.turbo/**",
        "**/build/**",
        "**/*.zip",
        "**/*.tar.gz",
      ],
    });

    await archive.finalize();
  } catch (e: any) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

export default router;
