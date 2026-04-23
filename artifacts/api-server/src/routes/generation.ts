import { Router } from "express";
import { getAuth } from "@clerk/express";
import { getUserKey } from "./user-keys";

const router = Router();

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function resolveApiKey(
  req: any,
  explicitKey: string | undefined,
  keyType: "fal" | "bfl" | "openai" | "google"
): Promise<string> {
  if (explicitKey?.trim()) return explicitKey.trim();
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (userId) {
    const dbKey = await getUserKey(userId, keyType);
    if (dbKey) return dbKey;
  }
  return process.env.FAL_API_KEY ?? process.env.BFL_API_KEY ?? process.env.GOOGLE_AI_KEY ?? "";
}

// ─── Image Generation ────────────────────────────────────────────────────────

router.post("/generate-image", async (req, res): Promise<void> => {
  const body = req.body as {
    prompt?: string;
    model?: string;
    count?: number;
    apiKey?: string;
    provider?: string;
  };

  if (!body.prompt || typeof body.prompt !== "string") {
    res.status(400).json({ error: "prompt مطلوب" });
    return;
  }

  const provider = body.provider ?? "fal";
  const model = body.model ?? "flux-schnell";
  const count = Math.min(body.count ?? 1, 4);
  const keyType = provider === "bfl-direct" ? "bfl" : provider === "openai" ? "openai" : "fal";
  const apiKey = await resolveApiKey(req, body.apiKey, keyType as any);

  if (!apiKey) {
    res.status(503).json({
      error: `أضف مفتاح ${provider === "bfl-direct" ? "BFL" : "fal.ai"} في إعداداتك الشخصية أولاً`,
    });
    return;
  }

  try {
    // ── BFL Direct API (api.bfl.ai) ──────────────────────────────────────
    if (provider === "bfl-direct") {
      const bflModelMap: Record<string, string> = {
        "flux-schnell": "flux-schnell",
        "flux-dev": "flux-dev",
        "flux-pro": "flux-pro-1.1",
        "flux-pro-1.1": "flux-pro-1.1",
      };
      const bflModel = bflModelMap[model] ?? "flux-pro-1.1";

      // Generate images one by one (BFL doesn't support batch)
      const images: string[] = [];
      for (let i = 0; i < count; i++) {
        // 1. Submit task
        const submitRes = await fetch(`https://api.bfl.ai/v1/${bflModel}`, {
          method: "POST",
          headers: {
            "X-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: body.prompt,
            width: 576,
            height: 1024,
            steps: bflModel.includes("schnell") ? 4 : 28,
            guidance: 3.5,
            safety_tolerance: 2,
            output_format: "jpeg",
          }),
        });

        if (!submitRes.ok) {
          const err = await submitRes.json().catch(() => ({})) as { message?: string; detail?: string };
          throw new Error(err.message ?? err.detail ?? `BFL error ${submitRes.status}`);
        }

        const { id } = await submitRes.json() as { id: string };

        // 2. Poll until ready (max 90s)
        let imageUrl: string | null = null;
        for (let attempt = 0; attempt < 30; attempt++) {
          await delay(3000);
          const pollRes = await fetch(`https://api.bfl.ai/v1/get_result?id=${id}`, {
            headers: { "X-Key": apiKey },
          });
          const pollData = await pollRes.json() as {
            status: string;
            result?: { sample?: string };
          };

          if (pollData.status === "Ready" && pollData.result?.sample) {
            imageUrl = pollData.result.sample;
            break;
          }
          if (pollData.status === "Error") {
            throw new Error("فشل توليد الصورة في BFL");
          }
          // statuses: Pending, Processing, Ready, Error
        }

        if (!imageUrl) throw new Error("انتهت مهلة BFL — حاول مجدداً");
        images.push(imageUrl);
      }

      res.json({ images });
      return;
    }

    // ── fal.ai (default) ─────────────────────────────────────────────────
    const falModelMap: Record<string, string> = {
      "flux-schnell": "fal-ai/flux/schnell",
      "flux-dev": "fal-ai/flux/dev",
      "flux-pro": "fal-ai/flux-pro/v1.1",
      "dalle3": "fal-ai/dalle-image-generator",
      "ideogram": "fal-ai/ideogram/v2",
    };
    const falModel = falModelMap[model] ?? model;

    const falRes = await fetch(`https://fal.run/${falModel}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: body.prompt,
        num_images: count,
        image_size: "portrait_9_16",
        num_inference_steps: model.includes("schnell") ? 4 : 28,
        enable_safety_checker: false,
      }),
    });

    if (!falRes.ok) {
      const err = await falRes.json().catch(() => ({})) as { detail?: string; message?: string };
      throw new Error(err.detail ?? err.message ?? `fal.ai ${falRes.status}`);
    }

    const falData = await falRes.json() as { images?: Array<{ url: string }> };
    res.json({ images: (falData.images ?? []).map((img) => img.url) });

  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "فشل توليد الصور" });
  }
});

// ─── Video Generation ────────────────────────────────────────────────────────

router.post("/generate-video", async (req, res): Promise<void> => {
  const body = req.body as {
    prompt?: string;
    model?: string;
    imageUrl?: string;
    apiKey?: string;
    provider?: string;
  };

  if (!body.prompt || typeof body.prompt !== "string") {
    res.status(400).json({ error: "prompt مطلوب" });
    return;
  }

  const provider = body.provider ?? "fal";
  const model = body.model ?? "veo-3";
  const keyType = provider === "google" ? "google" : "fal";
  const apiKey = await resolveApiKey(req, body.apiKey, keyType as any);

  if (!apiKey) {
    res.status(503).json({
      error: "أضف مفتاح fal.ai أو Google AI في إعداداتك الشخصية أولاً",
    });
    return;
  }

  try {
    // ── fal.ai (supports Veo 3, Kling, Runway, Pika) ─────────────────────
    if (provider === "fal") {
      const falModelMap: Record<string, string> = {
        "veo-3": "fal-ai/veo3",
        "veo-2": "fal-ai/veo2",
        "kling-1.6": "fal-ai/kling-video/v1.6/standard/image-to-video",
        "runway-gen4": "fal-ai/runway-gen3/image-to-video",
        "pika-2": "fal-ai/pika/v2.2/image-to-video",
      };
      const falModel = falModelMap[model] ?? model;

      const requestBody: Record<string, unknown> = {
        prompt: body.prompt,
        aspect_ratio: "9:16",
        duration: "5",
      };
      if (body.imageUrl) requestBody.image_url = body.imageUrl;

      // Veo 3 may use queue-based API on fal.ai
      const falRes = await fetch(`https://fal.run/${falModel}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!falRes.ok) {
        const err = await falRes.json().catch(() => ({})) as { detail?: string; message?: string };
        throw new Error(err.detail ?? err.message ?? `fal.ai ${falRes.status}`);
      }

      const falData = await falRes.json() as {
        video?: { url: string };
        url?: string;
        request_id?: string;
      };

      // If fal returns a request_id it's queued — poll for result
      if (falData.request_id && !falData.video?.url) {
        const reqId = falData.request_id;
        for (let i = 0; i < 40; i++) {
          await delay(5000);
          const statusRes = await fetch(`https://queue.fal.run/${falModel}/requests/${reqId}`, {
            headers: { Authorization: `Key ${apiKey}` },
          });
          const statusData = await statusRes.json() as {
            status?: string;
            output?: { video?: { url: string } };
          };
          if (statusData.status === "COMPLETED" || statusData.output?.video?.url) {
            res.json({ videoUrl: statusData.output?.video?.url ?? "" });
            return;
          }
          if (statusData.status === "FAILED") throw new Error("فشل توليد الفيديو في fal.ai");
        }
        throw new Error("انتهت مهلة توليد الفيديو — حاول مجدداً");
      }

      res.json({ videoUrl: falData.video?.url ?? falData.url ?? "" });
      return;
    }

    // ── Google AI Studio (Veo 3 direct) ──────────────────────────────────
    if (provider === "google") {
      const googleModel = model === "veo-2" ? "veo-002" : "veo-003";
      const submitRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:predictLongRunning?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [{
              prompt: body.prompt.slice(0, 1000),
              ...(body.imageUrl ? { image: { gcsUri: body.imageUrl } } : {}),
            }],
            parameters: {
              aspectRatio: "9:16",
              durationSeconds: 8,
              outputMimeType: "video/mp4",
            },
          }),
        }
      );

      if (!submitRes.ok) {
        const err = await submitRes.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? `Google AI ${submitRes.status}`);
      }

      const operation = await submitRes.json() as { name?: string };
      const opName = operation.name;
      if (!opName) throw new Error("Google AI لم يرجع operation ID");

      // Poll for result
      for (let i = 0; i < 30; i++) {
        await delay(5000);
        const pollRes = await fetch(
          `https://generativelanguage.googleapis.com/v1/${opName}?key=${apiKey}`
        );
        const pollData = await pollRes.json() as {
          done?: boolean;
          response?: { videos?: Array<{ uri?: string }> };
          error?: { message?: string };
        };

        if (pollData.done && pollData.response?.videos?.[0]?.uri) {
          res.json({ videoUrl: pollData.response.videos[0].uri });
          return;
        }
        if (pollData.error) throw new Error(pollData.error.message ?? "خطأ Google AI");
      }

      throw new Error("انتهت مهلة Google Veo — حاول مجدداً");
    }

    throw new Error(`المزود "${provider}" غير مدعوم`);

  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "فشل توليد الفيديو" });
  }
});

export default router;
