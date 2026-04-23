import { Router } from "express";
import { getServiceModel } from "./ai-providers";

const router = Router();

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Image Generation ────────────────────────────────────────────────────────

router.post("/generate-image", async (req, res): Promise<void> => {
  const body = req.body as {
    prompt?: string;
    count?: number;
  };

  if (!body.prompt || typeof body.prompt !== "string") {
    res.status(400).json({ error: "prompt مطلوب" });
    return;
  }

  const count = Math.min(body.count ?? 1, 4);

  // Resolve model from service assignment
  const cfg = await getServiceModel("image-generation");
  if (!cfg) {
    res.status(503).json({
      error: "لم يتم تعيين موديل لتوليد الصور — اذهب للإعدادات وخصص موديل لخدمة توليد الصور",
    });
    return;
  }

  const { baseUrl, apiKey, modelId } = cfg;
  const cleanBase = baseUrl.replace(/\/$/, "");

  try {
    // ── fal.ai ──────────────────────────────────────────────────────────────
    if (cleanBase.includes("fal.run") || cleanBase.includes("fal.ai")) {
      const images: string[] = [];
      for (let i = 0; i < count; i++) {
        const falRes = await fetch(`${cleanBase}/${modelId}`, {
          method: "POST",
          headers: {
            Authorization: `Key ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: body.prompt,
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
        if (url) images.push(url);
      }
      res.json({ images });
      return;
    }

    // ── OpenAI-compatible /images/generations (OpenRouter, custom) ───────────
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
        prompt: body.prompt,
        n: count,
        size: "1024x1792",
        response_format: "url",
      }),
    });

    if (!genRes.ok) {
      const err = await genRes.json().catch(() => ({})) as { error?: { message?: string }; message?: string };
      throw new Error(err.error?.message ?? (err as { message?: string }).message ?? `خطأ ${genRes.status}`);
    }

    const genData = await genRes.json() as { data?: Array<{ url?: string; b64_json?: string }> };
    const images = (genData.data ?? []).map((d) => d.url ?? "").filter(Boolean);
    res.json({ images });

  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "فشل توليد الصور" });
  }
});

// ─── Video Generation ────────────────────────────────────────────────────────

router.post("/generate-video", async (req, res): Promise<void> => {
  const body = req.body as {
    prompt?: string;
    imageUrl?: string;
  };

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
    // ── fal.ai ──────────────────────────────────────────────────────────────
    if (cleanBase.includes("fal.run") || cleanBase.includes("fal.ai")) {
      const requestBody: Record<string, unknown> = {
        prompt: body.prompt,
        aspect_ratio: "9:16",
        duration: "5",
      };
      if (body.imageUrl) requestBody.image_url = body.imageUrl;

      const falRes = await fetch(`https://fal.run/${modelId}`, {
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

    // ── OpenAI-compatible video (generic custom provider) ────────────────────
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
      const err = await vidRes.json().catch(() => ({})) as { error?: { message?: string }; message?: string };
      throw new Error(err.error?.message ?? (err as { message?: string }).message ?? `خطأ ${vidRes.status}`);
    }

    const vidData = await vidRes.json() as { url?: string; videoUrl?: string; data?: Array<{ url?: string }> };
    const videoUrl = vidData.url ?? vidData.videoUrl ?? vidData.data?.[0]?.url ?? "";
    res.json({ videoUrl });

  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "فشل توليد الفيديو" });
  }
});

export default router;
