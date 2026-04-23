import { Router } from "express";
import { getServiceModel } from "./ai-providers";

const router = Router();

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Detect nano-banana / 4kmedialive provider by base URL
function isNanoBanana(baseUrl: string, modelId: string): boolean {
  return baseUrl.includes("4kmedialive.com") || modelId === "nano-banana";
}

async function generateOneImage(prompt: string, cfg: { baseUrl: string; apiKey: string; modelId: string }): Promise<string> {
  const { baseUrl, apiKey, modelId } = cfg;
  const cleanBase = baseUrl.replace(/\/$/, "");

  // ── fal.ai (detected by URL or model format like "fal-ai/...") ──────────────
  const isFal = cleanBase.includes("fal.run") || cleanBase.includes("fal.ai") || modelId.startsWith("fal-ai/");
  if (isFal) {
    const falBase = isFal && !cleanBase.includes("fal.run") ? "https://fal.run" : cleanBase;
    const falRes = await fetch(`${falBase}/${modelId}`, {
      method: "POST",
      headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        num_images: 1,
        image_size: "portrait_9_16",
        num_inference_steps: modelId.includes("schnell") ? 4 : 28,
        enable_safety_checker: false,
      }),
    });
    if (!falRes.ok) {
      const err = await falRes.json().catch(() => ({})) as { detail?: string; message?: string };
      throw new Error(err.detail ?? err.message ?? `fal.ai ${falRes.status}`);
    }
    const falData = await falRes.json() as { images?: Array<{ url: string }> };
    const url = falData.images?.[0]?.url;
    if (!url) throw new Error("fal.ai لم يرجع رابط الصورة");
    return url;
  }

  // ── Nano Banana / 4K Media Live (synchronous Flux.1 — long timeout) ─────────
  if (isNanoBanana(cleanBase, modelId)) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5 * 60 * 1000); // 5-minute timeout
    try {
      const nbRes = await fetch(`${cleanBase}/images/generations`, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          prompt: prompt.slice(0, 4000),
          n: 1,
          size: "1024x1024",
          response_format: "url",
        }),
      });
      if (!nbRes.ok) {
        const err = await nbRes.json().catch(() => ({})) as { error?: { message?: string }; message?: string };
        const msg = (err as { error?: { message?: string } }).error?.message ?? (err as { message?: string }).message ?? `nano-banana ${nbRes.status}`;
        throw new Error(msg);
      }
      const nbData = await nbRes.json() as { data?: Array<{ url?: string }> };
      const url = nbData.data?.[0]?.url;
      if (!url) throw new Error("nano-banana لم يرجع رابط الصورة");
      return url;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error("انتهت مهلة توليد الصورة (5 دقائق) — حاول مجدداً");
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── OpenAI-compatible /images/generations (DALL-E 3, Stable Diffusion...) ──
  // Try standard images/generations endpoint first
  const genRes = await fetch(`${cleanBase}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://replit.com",
      "X-Title": "Reel Prompt Studio",
    },
    body: JSON.stringify({
      model: modelId,
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: "1024x1024",
      response_format: "url",
    }),
  });

  if (genRes.ok) {
    const genData = await genRes.json() as { data?: Array<{ url?: string; b64_json?: string }> };
    const url = genData.data?.[0]?.url;
    if (url) return url;
    throw new Error("الـ API لم يرجع رابط صورة");
  }

  // If /images/generations returned 404 → this model doesn't support image generation via this endpoint
  if (genRes.status === 404) {
    throw new Error(
      `الموديل "${modelId}" لا يدعم توليد الصور عبر هذا المزود.\n` +
      `للحصول على أفضل نتائج:\n` +
      `• OpenRouter: استخدم موديل "openai/dall-e-3"\n` +
      `• fal.ai (custom): استخدم "fal-ai/flux/schnell" أو "fal-ai/flux-pro/v1.1"`
    );
  }

  const errBody = await genRes.json().catch(() => ({})) as { error?: { message?: string }; message?: string };
  const errMsg = errBody.error?.message ?? (errBody as { message?: string }).message ?? `خطأ ${genRes.status}`;
  throw new Error(errMsg);
}

// ─── Image Generation ────────────────────────────────────────────────────────

router.post("/generate-image", async (req, res): Promise<void> => {
  const body = req.body as { prompt?: string; count?: number };

  if (!body.prompt || typeof body.prompt !== "string") {
    res.status(400).json({ error: "prompt مطلوب" });
    return;
  }

  const count = Math.min(body.count ?? 1, 4);

  const cfg = await getServiceModel("image-generation");
  if (!cfg) {
    res.status(503).json({
      error: "لم يتم تعيين موديل لتوليد الصور — اذهب للإعدادات وخصص موديل لخدمة توليد الصور",
    });
    return;
  }

  try {
    const images: string[] = [];
    for (let i = 0; i < count; i++) {
      const url = await generateOneImage(body.prompt, cfg);
      images.push(url);
    }
    res.json({ images });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "فشل توليد الصور" });
  }
});

// ─── Video Generation ────────────────────────────────────────────────────────

router.post("/generate-video", async (req, res): Promise<void> => {
  const body = req.body as { prompt?: string; imageUrl?: string };

  if (!body.prompt || typeof body.prompt !== "string") {
    res.status(400).json({ error: "prompt مطلوب" });
    return;
  }

  const cfg = await getServiceModel("video-generation");
  if (!cfg) {
    res.status(503).json({
      error: "لم يتم تعيين موديل لتوليد الفيديو — اذهب للإعدادات وخصص موديل لخدمة توليد الفيديو",
    });
    return;
  }

  const { baseUrl, apiKey, modelId } = cfg;
  const cleanBase = baseUrl.replace(/\/$/, "");

  try {
    // ── fal.ai (detected by URL or model path like "fal-ai/...") ─────────────
    const isFal = cleanBase.includes("fal.run") || cleanBase.includes("fal.ai") || modelId.startsWith("fal-ai/");
    if (isFal) {
      const requestBody: Record<string, unknown> = {
        prompt: body.prompt,
        aspect_ratio: "9:16",
        duration: "5",
      };
      if (body.imageUrl) requestBody.image_url = body.imageUrl;

      const falRes = await fetch(`https://fal.run/${modelId}`, {
        method: "POST",
        headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
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

      if (falData.request_id && !falData.video?.url) {
        const reqId = falData.request_id;
        for (let i = 0; i < 40; i++) {
          await delay(5000);
          const statusRes = await fetch(`https://queue.fal.run/${modelId}/requests/${reqId}`, {
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

    // ── Google AI (Veo) ───────────────────────────────────────────────────────
    if (cleanBase.includes("googleapis.com") || cleanBase.includes("generativelanguage")) {
      const googleModel = modelId.includes("veo-2") ? "veo-002" : "veo-003";
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
            parameters: { aspectRatio: "9:16", durationSeconds: 8, outputMimeType: "video/mp4" },
          }),
        }
      );

      if (!submitRes.ok) {
        const err = await submitRes.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? `Google AI ${submitRes.status}`);
      }

      const operation = await submitRes.json() as { name?: string };
      if (!operation.name) throw new Error("Google AI لم يرجع operation ID");

      for (let i = 0; i < 30; i++) {
        await delay(5000);
        const pollRes = await fetch(
          `https://generativelanguage.googleapis.com/v1/${operation.name}?key=${apiKey}`
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

    // ── Generic OpenAI-compatible video endpoint ─────────────────────────────
    const vidRes = await fetch(`${cleanBase}/video/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://replit.com",
        "X-Title": "Reel Prompt Studio",
      },
      body: JSON.stringify({
        model: modelId,
        prompt: body.prompt,
        ...(body.imageUrl ? { image_url: body.imageUrl } : {}),
        aspect_ratio: "9:16",
        duration: 5,
      }),
    });

    if (!vidRes.ok) {
      const errBody = await vidRes.json().catch(() => ({})) as { error?: { message?: string }; message?: string };
      throw new Error(errBody.error?.message ?? (errBody as { message?: string }).message ?? `خطأ ${vidRes.status}`);
    }

    const vidData = await vidRes.json() as { url?: string; videoUrl?: string; data?: Array<{ url?: string }> };
    const videoUrl = vidData.url ?? vidData.videoUrl ?? vidData.data?.[0]?.url ?? "";
    res.json({ videoUrl });

  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "فشل توليد الفيديو" });
  }
});

export default router;
