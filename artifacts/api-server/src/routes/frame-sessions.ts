import { Router } from "express";
import { db, frameSessionsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";

const router = Router();

type FrameInput = { index: number; dataUrl: string; timestampMs: number };

function uid(req: Parameters<typeof getAuth>[0]): string | null {
  return getAuth(req)?.userId ?? null;
}

function serializeSession(row: typeof frameSessionsTable.$inferSelect, includeFrames: boolean) {
  return {
    id: row.id,
    videoName: row.videoName,
    videoDurationMs: row.videoDurationMs,
    videoWidth: row.videoWidth,
    videoHeight: row.videoHeight,
    frameCount: row.frameCount,
    mode: row.mode,
    quality: parseFloat(row.quality),
    createdAt: row.createdAt.toISOString(),
    ...(includeFrames ? { frames: JSON.parse(row.frames) as FrameInput[] } : {}),
  };
}

router.get("/frame-sessions", async (req, res): Promise<void> => {
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rows = await db
    .select()
    .from(frameSessionsTable)
    .where(eq(frameSessionsTable.userId, userId))
    .orderBy(desc(frameSessionsTable.createdAt));

  res.json(rows.map((row) => serializeSession(row, false)));
});

router.post("/frame-sessions", async (req, res): Promise<void> => {
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const body = req.body as {
    videoName?: unknown;
    videoDurationMs?: unknown;
    videoWidth?: unknown;
    videoHeight?: unknown;
    frameCount?: unknown;
    frames?: unknown;
    mode?: unknown;
    quality?: unknown;
  };

  if (!body.videoName || typeof body.videoName !== "string") {
    res.status(400).json({ error: "videoName is required" });
    return;
  }
  if (typeof body.videoDurationMs !== "number") {
    res.status(400).json({ error: "videoDurationMs is required" });
    return;
  }
  if (!Array.isArray(body.frames) || body.frames.length === 0) {
    res.status(400).json({ error: "frames array is required" });
    return;
  }

  const [row] = await db
    .insert(frameSessionsTable)
    .values({
      userId,
      videoName: body.videoName,
      videoDurationMs: Math.round(body.videoDurationMs as number),
      videoWidth: typeof body.videoWidth === "number" ? body.videoWidth : 0,
      videoHeight: typeof body.videoHeight === "number" ? body.videoHeight : 0,
      frameCount: Array.isArray(body.frames) ? body.frames.length : 0,
      frames: JSON.stringify(body.frames),
      mode: typeof body.mode === "string" ? body.mode : "count",
      quality: typeof body.quality === "number" ? String(body.quality) : "0.92",
    })
    .returning();

  res.status(201).json(serializeSession(row, false));
});

router.get("/frame-sessions/:id", async (req, res): Promise<void> => {
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const [row] = await db
    .select()
    .from(frameSessionsTable)
    .where(and(eq(frameSessionsTable.id, id), eq(frameSessionsTable.userId, userId)));

  if (!row) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(serializeSession(row, true));
});

router.delete("/frame-sessions/:id", async (req, res): Promise<void> => {
  const userId = uid(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  await db.delete(frameSessionsTable).where(and(eq(frameSessionsTable.id, id), eq(frameSessionsTable.userId, userId)));
  res.status(204).send();
});

export default router;
