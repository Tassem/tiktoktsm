import type { Niche } from "@workspace/db";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { getServiceModel } from "../routes/ai-providers";

const execFileAsync = promisify(execFile);

type VoiceoverData = {
  text: string;
  language?: string;
  speaker?: string;
  emotion?: string;
  deliveryNotes?: string;
};

type SoundDesignData = {
  music?: string;
  sfx?: string[];
  ambient?: string;
  transition?: string;
};

type CameraData = {
  angle?: string;
  movement?: string;
  lensStyle?: string;
};

type TextOverlayData = {
  text?: string;
  position?: string;
  fontStyle?: string;
  color?: string;
  animation?: string;
};

type CharacterData = {
  id: string;
  description: string;
  firstAppearance?: number;
  appearances?: number[];
  clothingLog?: Array<{ scenes: number[]; outfit: string }>;
};

type TranscriptionSegment = {
  start: number;
  end: number;
  text: string;
  language: string;
};

type ValidationResult = {
  passed: boolean;
  issues: string[];
  severity: "critical" | "warning" | "ok";
  qualityScore: number;
};

type GeneratedScene = {
  sceneNumber: number;
  sceneType: string;
  title: string;
  imagePrompt: string;
  animationPrompt: string;
  voiceOverDarija: string;
  soundEffectsPrompt: string;
  sceneFrameUrl?: string | null;
  timestampStart?: string | null;
  timestampEnd?: string | null;
  duration?: number | null;
  mood?: string | null;
  narrativePurpose?: string | null;
  camera?: CameraData | null;
  voiceover?: VoiceoverData | null;
  soundDesign?: SoundDesignData | null;
  textOverlay?: TextOverlayData | null;
};

type GeneratedPromptPack = {
  summaryPrompt: string;
  title: string;
  scenes: GeneratedScene[];
  detectedLanguage?: string | null;
  totalScenes?: number | null;
  durationSeconds?: number | null;
  aspectRatio?: string | null;
  overallStyle?: string | null;
  colorGrading?: string | null;
  moodProgression?: string | null;
  contentCategory?: string | null;
  viralElements?: string[] | null;
  characters?: CharacterData[] | null;
  qualityScore?: number | null;
  validationIssues?: string[] | null;
  retryCount?: number | null;
};

const darijaLines = [
  "Chouf had lfikra mezian, rah ghadi tbedel tari9a li katfeker biha.",
  "Fhad nitch, lmochkil machi f lma3louma, lmochkil f kifach katban.",
  "Ila bghiti tban professional, khas lmessage tkun basita o katdreb f lwje3.",
  "Hna fin katban lfor9a bin content 3adi o content kaytched f dmagh.",
  "Matb9ach tdir nafs lformat, jreb had l'angle o chouf reaction dyal nass.",
  "Kol scene khas-ha tzed wahd l'i7sas: curiosity, trust, wla decision.",
  "Had lmoment howa li kaykheli lviewer ygol: ah, hada kayhdr 3liya.",
  "Dir lfocus 3la result wa7ed, machi bzaf d l'afkar f nafs lwa9t.",
  "Khlli lvisual ychra7 bla ma voice-over y3awd kolchi mn lwel.",
  "Sali b call clear: ila bghiti had natija, bda b had step daba.",
];

async function resolveAiConfig(serviceName: string): Promise<{ baseUrl: string; apiKey: string; modelId: string }> {
  // 1. Try DB-configured provider for this service
  const dbModel = await getServiceModel(serviceName);
  if (dbModel) return dbModel;

  // 2. Fall back to Replit AI Integration env vars
  const baseUrl = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (baseUrl && apiKey) {
    return { baseUrl, apiKey, modelId: "gpt-5.4" };
  }

  throw new Error(
    `لم يتم تكوين أي مزود ذكاء اصطناعي لخدمة "${serviceName}". يرجى إضافة مزود وتعيينه في صفحة الإعدادات.`
  );
}

export async function buildRemixPromptPack(input: {
  originalTitle: string;
  originalSummaryPrompt: string;
  originalScenes: Array<{
    title: string;
    imagePrompt: string;
    animationPrompt: string;
    voiceOverDarija: string;
    soundEffectsPrompt: string;
  }>;
  storyIdea: string;
  concept: string;
  systemPromptOverride?: string;
  modelOverride?: string | null;
}): Promise<GeneratedPromptPack> {
  const { baseUrl, apiKey, modelId: defaultModel } = await resolveAiConfig("remix");

  const originalScenesText = input.originalScenes
    .map(
      (s, i) =>
        `Scene ${i + 1}: ${s.title}\nImage: ${s.imagePrompt.slice(0, 300)}\nDialogue: ${s.voiceOverDarija.slice(0, 300)}`,
    )
    .join("\n\n");

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.modelOverride?.trim() || defaultModel,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: input.systemPromptOverride ?? `You are a master storyteller and AI video-to-prompt engineer. Your specialty is writing COMPLETE, NARRATIVELY COHERENT short-film stories for AI video generators (Kling, Sora, Runway, Pika).

CORE PHILOSOPHY:
— A story is not a list of moments. A story is a JOURNEY with cause and effect.
— Every scene must have: a clear DRAMATIC PURPOSE, a visible CONFLICT or EMOTION, and a direct link to the next scene.
— "Complete" means: by the end of your scenes, the viewer understands fully what happened, why it happened, and what changed.
— Never write a scene that is only a "snapshot". Every scene must MOVE the story forward.
— ESTABLISH BEFORE REVEAL: Before any confrontation or discovery, the audience must first understand the relationship/situation being confronted or discovered.

CRITICAL — CHARACTER SPECIES LOCK:
— A character's species/type is determined by their FAMILY LINEAGE, not by other characters' names.
— Example: If Character A belongs to the strawberry family, all their family members are also strawberry characters — even if another character in the story is named "Apple" or "Banana".
— In EVERY imagePrompt, explicitly label each character's species: "strawberry-headed father", "apple-headed young man". Never assume or infer species from another character's name.
— Family members always share the same species. Never cross-contaminate species between characters.

OUTPUT: Strict JSON only. All imagePrompts/animationPrompts/soundEffectsPrompts in English. voiceOverDarija in Moroccan Darija (Arabic script).`,
        },
        {
          role: "user",
          content: `═══════════════════════════════════════════
VISUAL STYLE TO PRESERVE (from original pack):
${input.originalSummaryPrompt || `Title: ${input.originalTitle}`}
═══════════════════════════════════════════

NEW STORY CONCEPT:
${input.storyIdea}

CONCEPT TITLE: ${input.concept}
═══════════════════════════════════════════

YOUR TASK — THREE MANDATORY STEPS:

━━━ STEP 1: DEFINE YOUR CHARACTERS + STATE LOG ━━━
Before writing scenes, define every character with a COMPLETE physical anchor AND a state log:

For each character write:
- Name, role in story
- FRUIT/SPECIES TYPE (CRITICAL — determine from family lineage, NOT from other characters' names):
  • A character named "Apple" (تفاحة) = apple-headed character
  • Frizita's FATHER = STRAWBERRY-headed, even if the love interest is named "Apple"
  • Rule: Family members share the same species. Never cross-contaminate species from a character's name to another character's appearance.
- HAIR / HEAD-TOP: For stylized characters — describe the organic element on their head (e.g., "crown of deep-green strawberry leaves in a fan shape"). For human characters — exact color+length+style+texture.
- FACE DESIGN (mandatory — missing = REJECTED):
  • Eyes: color, shape (large round / almond / narrow), size, eyelash style, pupil highlight
  • Nose: shape and size
  • Mouth/lips: shape, color, default expression
  • Eyebrows: color, thickness, arch
  • Face shape: round / oval / elongated
  • For animated: face surface material (smooth glossy / clay matte / plastic sheen), are eyes painted-on flat or 3D raised?
- Skin tone: precise (fair/ivory, warm olive, caramel, dark brown, etc.)
- Clothing: exact color names, garment type, fit, pattern
- Body: height relative to others, build
- Emotional default

STATE LOG — Track appearance changes scene by scene:
- Starting state: [full appearance at scene 1]
- If any scene event physically changes the character (hair removed, accessory lost, outfit change, injury, etc.): LOG IT and apply to ALL subsequent scenes
- ⚠️ A change in scene N means every imagePrompt from scene N onward shows the POST-CHANGE state
- Example: "Leaf crown removed in Scene 1 → Scene 2, 3, 4... show bare smooth fruit head, explicitly written: 'no leaf crown, smooth bare top'"

This FULL anchor (including state log result for the current scene) is COPIED verbatim into every imagePrompt.

━━━ STEP 2: PLAN THE STORY ARC ━━━
Map out a COMPLETE story in beats. Your story MUST follow this structure:
  ACT 1 — SETUP (1-2 scenes):
    • Establish characters and their relationship/dynamic clearly
    • Show the "normal world" or the secret situation being established
    • The viewer must understand WHO these characters are to each other
  ACT 2A — DEVELOPMENT (1-2 scenes):
    • The situation deepens or complications arise
    • Show the relationship or secret more explicitly
    • Hint at the coming conflict without resolving it
  ACT 2B — CONFLICT/DISCOVERY (1-2 scenes):
    • The turning point — a discovery, confrontation, or revelation
    • HIGH EMOTIONAL STAKES — characters react authentically
    • Cause must be clearly connected to Act 1 setup
  ACT 3 — CLIMAX + RESOLUTION (1-2 scenes):
    • The direct confrontation or decision moment
    • Characters must CHOOSE or CHANGE as a result of Act 2B
    • End with an emotional payoff — the viewer must feel closure or impact

TOTAL SCENES: Write as many scenes as the story NEEDS to feel complete (usually 5-8). Do NOT cut scenes to save space. Incomplete stories are failures.

━━━ STEP 3: WRITE EACH SCENE — FORENSIC DETAIL REQUIRED ━━━
For EVERY scene, provide:

imagePrompt rules:
- MIN 180 WORDS. Must be 100% self-contained — describe everything as if the reader has NEVER seen any other scene or character definition.
- ⚠️ ZERO VAGUE SENTENCES. Every attribute must be specific:
  BAD: "wearing a blue shirt" → GOOD: "slim-fit cobalt-blue linen button-down shirt, top two buttons open, slightly wrinkled"
  BAD: "brown hair" → GOOD: "shoulder-length chestnut-brown hair with subtle warm highlights, loose waves, center-parted"
  BAD: "light skin" → GOOD: "fair ivory skin with a warm peach undertone"
- MUST INCLUDE (in this order):
  1. Art style + vertical 9:16 ratio
  2. For EACH character in frame:
     a. Species label (for animated)
     b. Hair/head-top: exact color+length+style for humans; exact organic description for stylized ("crown of deep-green leaves" or "bare smooth top — leaf crown removed")
     c. FACE: eyes (color + shape + size + eyelash style), nose (shape), mouth/lips (shape + color + expression), eyebrows, face shape, face surface material for animated
     d. Skin tone with undertone
     e. Clothing: exact color name + garment type + fit + pattern
     f. Body: height relative to others + build
     g. Spatial position in frame
     h. CHARACTER STATE NOTE: explicitly write current state (e.g., "leaf crown removed since Scene 1 — head is bare and smooth, no leaves present")
  3. Exact environment (room type, wall color+material, floor type, furniture with color, light source, time of day)
  4. Camera framing + angle
  5. Lighting (direction + quality + color temperature)
  6. Color palette (3-4 specific hues)
  7. Mood + atmosphere
  8. Key props with position
- NEVER write "same style as before", "as established", or any cross-scene reference.
- ⚠️ STATE CONTINUITY: If a character's appearance changed in a previous scene, the change MUST be reflected here. Never show an element that was removed in an earlier scene.

animationPrompt rules:
- MIN 130 WORDS. Describe exact camera movement (type, speed, direction, axis), every character's body movement path, facial expression sequence, hand/body gestures, shot duration estimate, transition type into next scene, and emotional arc.
- SPEAKER BLOCKING (mandatory for EVERY dialogue line — no exceptions):
  ✅ [CHARACTER_A speaks]: "line" — ⚠️ CHARACTER_B keeps mouth fully closed, eyes focused on CHARACTER_A, hands still
  ✅ [CHARACTER_B responds]: "line" — ⚠️ CHARACTER_A keeps mouth fully closed, shows micro-expression reaction only
- Describe micro-expressions: eyebrow movements, lip tension, jaw set, eye direction during each line.

voiceOverDarija rules:
- Natural, emotionally authentic Moroccan Darija dialogue
- Format: CharacterName: "line"
- Each character's voice must be DISTINCT (one is formal, one is nervous, one is cold, etc.)
- Minimum 3-4 lines of real back-and-forth per scene that has dialogue

soundEffectsPrompt:
- Specific atmospheric sounds, music mood, and emotional tone
- Match the emotional beat of the scene

═══════════════════════════════════════════
Return ONLY this JSON (no markdown, no extra text):
{
  "title": "precise dramatic title for this story",
  "summaryPrompt": "### Style\\n* **Visual Texture:** [exact]\\n* **Lighting Quality:** [exact]\\n* **Color Palette:** [exact]\\n* **Atmosphere:** [exact]\\n\\n### Cinematography\\n* **Camera:** [exact]\\n* **Lens:** [exact]\\n* **Lighting Setup:** [exact]\\n* **Mood:** [exact]",
  "scenes": [
    {
      "title": "ACT + specific dramatic beat label",
      "imagePrompt": "complete self-contained image prompt (min 150 words, full character anchors, full environment, full style)",
      "animationPrompt": "complete animation prompt with speaker blocking for every dialogue line (min 100 words)",
      "voiceOverDarija": "CharacterA: \\"line\\"\\nCharacterB: \\"line\\"\\nCharacterA: \\"line\\"",
      "soundEffectsPrompt": "specific atmospheric sound design"
    }
  ]
}`,
        },
      ],
      max_completion_tokens: 28000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI remix generation failed: ${errorText.slice(0, 500)}`);
  }

  const responseJson = await response.json();
  const payload = responseJson as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI remix returned an empty response.");
  }

  const parsed = (await parseOrRepairJsonObject(content, baseUrl, apiKey)) as {
    title?: string;
    summaryPrompt?: string;
    scenes?: Array<Partial<GeneratedScene>>;
  };

  if (!Array.isArray(parsed.scenes) || parsed.scenes.length < 1) {
    throw new Error("AI remix did not return any scenes.");
  }

  return {
    title: truncateGeneratedText(parsed.title || input.concept, 120),
    summaryPrompt: truncateGeneratedText(
      parsed.summaryPrompt || input.originalSummaryPrompt,
      5000,
    ),
    scenes: parsed.scenes.map((scene, index) => {
      const title = truncateGeneratedText(scene.title || `Scene ${index + 1}`, 160);
      return {
        sceneNumber: index + 1,
        sceneType: (index === 0 ? "hook" : "scene") as GeneratedScene["sceneType"],
        title,
        imagePrompt: requireGeneratedText(
          scene.imagePrompt,
          "image prompt",
          `Vertical 9:16 image for scene: ${title}. Match the original pack's visual style.`,
        ),
        animationPrompt: requireGeneratedText(
          scene.animationPrompt,
          "animation prompt",
          `Animate this scene with camera movement and character action. Speaker blocking: only the named speaker's mouth moves per dialogue line.`,
        ),
        voiceOverDarija: normalizeDialogueBlock(scene.voiceOverDarija, "لا يوجد حوار في هذا المشهد."),
        soundEffectsPrompt: requireGeneratedText(
          scene.soundEffectsPrompt,
          "sound prompt",
          "Use background sound and music matching the original pack's audio mood.",
        ),
      };
    }),
  };
}

export function buildDemoPromptPack(input: {
  niche: Niche;
  concept: string;
  reelNotes: string;
}): GeneratedPromptPack {
  const { niche, concept, reelNotes } = input;
  const summaryPrompt = `Analyze the submitted reel for the ${niche.name} niche. Extract the strongest content mechanism, emotional hook, pacing pattern, and conversion angle. Rebuild it as a new concept: ${concept}. Keep all image, animation, and sound prompts in English, and write voice-over lines in Moroccan Darija. Source notes: ${reelNotes}`;

  const scenes = Array.from({ length: 10 }, (_, index) => {
    const sceneNumber = index + 1;
    const sceneType: GeneratedScene["sceneType"] = sceneNumber === 1 ? "hook" : "scene";
    const role = sceneType === "hook" ? "scroll-stopping hook" : `story beat ${sceneNumber}`;
    const title = sceneType === "hook" ? `Hook: ${concept}` : `Scene ${sceneNumber}: ${niche.contentAngle}`;

    return {
      sceneNumber,
      sceneType,
      title,
      imagePrompt: `Create a vertical 9:16 cinematic image for ${role} in the ${niche.name} niche. Concept: ${concept}. Audience: ${niche.audience}. Show a concrete, high-contrast visual metaphor connected to this angle: ${niche.contentAngle}. Use realistic lighting, strong foreground subject, clean negative space for captions, and premium social media composition.`,
      animationPrompt: `Animate this vertical scene with smooth camera movement, subtle parallax, fast caption rhythm, and a clear transition into the next beat. Keep motion focused on the key object/person and preserve space for short on-screen text.`,
      voiceOverDarija: darijaLines[index],
      soundEffectsPrompt: `Use crisp reel-style sound design: ${sceneType === "hook" ? "sharp impact hit, short riser, clean bass pulse" : "soft whoosh transitions, tactile UI ticks, warm ambient texture"}. Keep music modern, confident, and not distracting from Moroccan Darija voice-over.`,
    };
  });

  return {
    summaryPrompt,
    title: `${niche.name}: ${concept}`,
    scenes,
  };
}

export async function buildAIVideoPromptPack(input: {
  niche: Niche;
  concept: string;
  reelNotes: string;
  videoFrames: string[];
  videoDataUrl?: string;
  systemPromptOverride?: string;
  modelOverride?: string | null;
}): Promise<GeneratedPromptPack> {
  const { baseUrl, apiKey, modelId: defaultModel } = await resolveAiConfig("video-analysis");

  // Run scene detection and audio transcription in parallel when video data is available
  const [sceneDetection, transcriptionResult] = await Promise.all([
    input.videoDataUrl
      ? import("./scene-detect.js").then((m) => m.detectScenesFromVideo(input.videoDataUrl!)).catch(() => null)
      : Promise.resolve(null),
    input.videoDataUrl
      ? transcribeVideoAudioWithSegments(input.videoDataUrl, baseUrl, apiKey).catch(() => ({ text: null, segments: [] }))
      : Promise.resolve({ text: null, segments: [] }),
  ]);

  const audioTranscript = transcriptionResult.text;
  const audioSegments = transcriptionResult.segments;

  // Dynamic frame cap based on scene count
  const sceneCount = sceneDetection?.sceneTimestamps.length ?? 0;
  const dynamicFrameCap = sceneCount <= 20 ? 40 : sceneCount <= 35 ? 60 : 80;

  // Smart frame selection: prioritize scene-change frames, fill gaps with interval frames
  const frameInputs = buildSmartFrameInputs(
    input.videoFrames,
    sceneDetection?.sceneTimestamps ?? [],
    sceneDetection?.durationSeconds ?? 0,
    dynamicFrameCap,
    "low",
  );

  if (frameInputs.frames.length === 0) {
    throw new Error("No video frames were provided for analysis.");
  }

  const detectedSceneCount = sceneDetection?.totalScenes ?? 0;
  const videoDuration = sceneDetection?.durationSeconds ?? 0;

  // Build rich scene change info with confidence levels
  const sceneChangeInfo = sceneDetection
    ? `\n- Scene detection (adaptive threshold=${sceneDetection.detectionThresholdUsed}) found ${sceneDetection.sceneTimestamps.length} visual cuts (${detectedSceneCount} total scenes, avg ${sceneDetection.averageSceneDuration}s/scene): [${sceneDetection.sceneChanges.map((c) => `${c.timestamp.toFixed(1)}s (${c.type}, confidence=${c.confidence.toFixed(2)})`).join(", ")}]. Frames marked with [SCENE-CHANGE] are at these cut points.`
    : "";
  const frameTimingInfo = frameInputs.timestamps.length > 0
    ? `\n- Frame timestamps: ${frameInputs.timestamps.map((t, i) => `Frame ${i + 1}: ${t.toFixed(1)}s${frameInputs.sceneChangeFlags[i] ? " [SCENE-CHANGE]" : ""}`).join(", ")}`
    : "";

  // Build structured audio transcription with timestamps
  const audioTranscriptInfo = audioSegments.length > 0
    ? buildStructuredTranscription(audioSegments, sceneDetection?.sceneTimestamps ?? [])
    : audioTranscript || "No usable speech transcript was extracted. Describe background sound from visual context only and do not claim exact spoken lines.";
  const sendAnalysisRequest = (frames: ReturnType<typeof buildFrameInputs>, retryNote = "") => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8 * 60 * 1000); // 8-min hard timeout for deeper analysis
    return fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.modelOverride?.trim() || defaultModel,
        ...((input.systemPromptOverride ?? "").match(/JSON.OUTPUT.BELOW/i)
          ? {}
          : { response_format: { type: "json_object" } }),
        messages: [
          {
            role: "system",
            content: input.systemPromptOverride ??
              `You are an elite video-to-prompt forensic engineer. Your output is fed directly into AI video generators (Kling, Sora, Runway, Pika). Every prompt you write must be copy-ready with zero ambiguity: a video generator reading your prompt must produce the exact same scene without seeing the original video.

══════════════════════════════════════════
ABSOLUTE RULES — NEVER VIOLATE
══════════════════════════════════════════

RULE 1 — COMPLETENESS:
You will be given frames from a video with scene-change timestamps. You MUST create a scene entry for EVERY detected scene change timestamp. Missing even ONE timestamp = FAILURE.

RULE 2 — MINIMUM SCENE COUNT:
${detectedSceneCount > 0 ? `Based on scene detection, there are approximately ${detectedSceneCount} scenes in this ${videoDuration.toFixed(1)}s video. Your output MUST contain at least ${detectedSceneCount} scene objects. If you detect additional scenes not in the provided timestamps, ADD THEM. Never return fewer than ${detectedSceneCount} scenes.` : `Analyze the frames carefully to detect all scenes. Never merge distinct shots into one scene.`}

RULE 3 — PROMPT LENGTH:
Every image_prompt MUST be minimum 80 words. Short prompts = FAILURE. Every prompt must include: environment + character + lighting + camera + mood.

RULE 4 — NO SKIPPING:
Even if two consecutive scenes look similar, describe each one separately and completely. Never write "same as previous scene" or "similar to scene X". Every scene is standalone and complete.

RULE 5 — TIMESTAMP ACCURACY:
Timestamps must be sequential and non-overlapping. timestamp_end of scene N must equal or be very close to timestamp_start of scene N+1. No gaps > 1 second between consecutive scenes.

RULE 6 — CHARACTER CONSISTENCY:
Once you describe a character's appearance, that description is LOCKED. The exact same physical description must appear in every scene that character appears in. Never change hair color, skin tone, or clothing mid-video unless there is a visible costume change in the frames.

══════════════════════════════════════════

Your analysis follows 4 PHASES in strict order:
1. SCENE DETECTION — identify every distinct scene/shot
2. DEEP ANALYSIS — forensic-level detail per scene
3. CHARACTER IDENTITY LOCK — build a character registry with consistent descriptions
4. GLOBAL VIDEO METADATA — overall video properties

Before writing your JSON, follow this checklist:
□ Count the scene-change timestamps provided
□ Your scenes[] array must have at least that many entries
□ Every scene has: image_prompt (80+ words), animation_prompt, voiceover, sound_design, timestamp_start, timestamp_end
□ All timestamps are sequential
□ Character descriptions are consistent
□ Total scenes matches your totalScenes field

Return strict JSON only.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze every sampled frame from this video and produce a COMPLETE, FORENSIC-LEVEL analysis of EVERY scene. These frames are sampled across the full video — use them to reconstruct the full visible flow from beginning to end.

══════════════════════════════════════════
PHASE 1: SCENE DETECTION — FIND EVERY SCENE
══════════════════════════════════════════
Before writing any prompts, FIRST identify EVERY distinct scene/shot:

1. A "new scene" is defined as ANY of these changes:
   - Camera angle change
   - Location/background change
   - New character appearing
   - Significant lighting change
   - Text overlay appearing/changing
   - Time skip (indicated by visual change)
   - Transition effect (fade, cut, zoom)

2. Number each scene sequentially.

3. Map each scene to its timestamp range (start → end) using the frame timestamps provided.

4. ⚠️ Do NOT skip ANY scene, no matter how short — even 0.5-second scenes MUST be captured.

══════════════════════════════════════════
PHASE 2: DEEP ANALYSIS PER SCENE
══════════════════════════════════════════
For EACH detected scene, provide ALL of the following:

**A. Image Prompt (Forensic Detail — MIN 150 WORDS)**
Write a complete, self-contained AI image generation prompt covering:
- **Environment:** Exact location, time of day, weather, indoor/outdoor, architectural details, wall color/texture, floor material, furniture
- **Characters:** Full physical description for EVERY character:
  • HAIR: exact color (jet-black/chestnut brown/honey blonde — NOT just "black"), length (buzzcut/shoulder-length/waist-length), style (straight/wavy/curls/braided/ponytail)
  • FACE: eye color+shape+size, nose shape, mouth/lip shape+color, eyebrows, face shape, distinguishing marks (scars/moles/freckles — write "none visible" if absent)
  • SKIN TONE: precise descriptor (fair ivory/warm olive/medium tan/golden brown/caramel/deep ebony)
  • BODY: height relative to others, build (slender/athletic/stocky), posture
  • For STYLIZED characters: head shape (fruit/vegetable type), body material (clay/glossy resin/plastic), face surface
- **Clothing:** Exact outfit — color name, garment type, fit (loose/fitted/oversized), pattern, texture, logos. Never "blue shirt" — write "slim-fit navy-blue cotton polo shirt with white stitching on collar"
- **Accessories:** Every piece of jewelry, glasses, hats, bags with attachment point — write "no accessories" if none
- **Pose & Expression:** Body position, hand placement, facial expression, eye direction, mouth state
- **Objects:** Every visible object with exact position
- **Framing:** Camera angle (close-up/medium/wide/bird's eye), lens style, depth of field
- **Lighting:** Direction, color temperature, shadows, highlights, ambient vs direct
- **Color Palette:** 3-4 dominant hues, color grading style, saturation, contrast
- **Text/Graphics:** Any on-screen text with font style, position, color, language
- ⚠️ Every imagePrompt must be 100% SELF-CONTAINED. Never reference "as described above" or "same as previous".
- ⚠️ ZERO vague sentences. "wearing colorful clothes" = INVALID.

**B. Animation/Motion Prompt (MIN 120 WORDS)**
- Camera movement (pan, tilt, zoom, static, tracking, speed)
- Character movement path, facial expression evolution, body gestures
- Object movement
- Speed (slow motion, normal, fast, time-lapse)
- Shot duration estimate
- Transition to next scene (cut, fade, dissolve, wipe)
- Emotional arc of the scene
- SPEAKER BLOCKING (when dialogue): for each line, name who speaks, describe mouth movement, and ⚠️ explicitly confirm all other characters keep mouths CLOSED

**C. Voice-Over Script**
Provide as a structured voiceover object:
- Exact transcription of speech (Moroccan Darija in Arabic script preferred)
- Language identification (darija/arabic/french/english/mixed)
- Speaker ID (use character registry IDs, e.g. "CHAR_01")
- Emotional tone (excited/calm/angry/funny/sarcastic)
- Delivery notes (fast-paced/slow/whispered/shouted)
- If no speech: describe silence or ambient sound

**D. Sound Design**
Provide as a structured object:
- Background music (genre, tempo, mood, instruments)
- Sound effects list (footsteps, impacts, whooshes)
- Ambient sounds (wind, traffic, crowd)
- Audio transition to next scene
- Volume dynamics

**E. Scene Metadata**
- Scene number
- Timestamp: start → end (e.g., "00:00.000" → "00:02.500")
- Duration in seconds
- Scene type: hook | establishing | dialogue | action | transition | text-overlay | montage | reaction | CTA
- Mood/emotion
- Narrative purpose (setup/conflict/climax/resolution/hook/CTA)
- Camera object: angle, movement, lens style
- Text overlay object (if any on-screen text): text, position, font style, color, animation

══════════════════════════════════════════
PHASE 3: CHARACTER IDENTITY LOCK
══════════════════════════════════════════
After analyzing all scenes, build a CHARACTER REGISTRY in the "characters" array:
- For each unique character/person:
  • Character ID (e.g., "CHAR_01")
  • Full forensic description (MUST be consistent across all scenes)
  • First appearance (scene number)
  • All appearances (list of scene numbers)
  • Clothing changes across scenes (document each outfit change with scene numbers)

CHARACTER STATE CONTINUITY:
- Track a "STATE LOG" for each character across scenes
- When an event changes a character (removes accessory, changes outfit, gets injured), ALL subsequent imagePrompts must reflect the POST-CHANGE state
- Explicitly note removals: "NOTE: leaf crown removed — head is now bare"

DIALOGUE SPEAKER LOCK:
- The character ID before the colon in voiceover is the ONLY character whose mouth moves
- All others: mouths fully closed. This is NON-NEGOTIABLE
- Never swap dialogue between characters

══════════════════════════════════════════
PHASE 4: GLOBAL VIDEO METADATA
══════════════════════════════════════════
Provide these top-level fields:
- detected_language: primary language (darija/arabic/french/english/mixed)
- total_scenes: count of all detected scenes
- duration_seconds: estimated total video duration
- aspect_ratio: (9:16, 16:9, 1:1)
- overall_style: visual style (cinematic/vlog/meme/tutorial/aesthetic/animated)
- color_grading: color grading description
- mood_progression: how mood evolves through the video
- content_category: niche/category of content
- viral_elements: array of identified viral elements (hook/pattern_interrupt/CTA/emotional_trigger/curiosity_gap)

═══════════════════
WHAT TO IGNORE
═══════════════════
- Do not let niche metadata override what is actually visible in frames
- Do not mention file names or source names
- Do not invent details not visible or audible
- Do not write generic descriptions unrelated to the actual video

═══════════════════
ADDITIONAL CONTEXT
═══════════════════
- User notes: ${input.reelNotes}
- Audio transcript: ${audioTranscriptInfo}${sceneChangeInfo}${frameTimingInfo}
${retryNote}

═══════════════════
OUTPUT FORMAT (JSON)
═══════════════════
Return JSON with exactly this structure:

{
  "title": "short precise title describing the actual visible video content",
  "detected_language": "darija|arabic|french|english|mixed",
  "total_scenes": <number>,
  "duration_seconds": <number>,
  "aspect_ratio": "9:16",
  "overall_style": "...",
  "color_grading": "...",
  "mood_progression": "...",
  "content_category": "...",
  "viral_elements": ["hook", "pattern_interrupt", "CTA"],

  "characters": [
    {
      "id": "CHAR_01",
      "description": "full forensic physical description",
      "first_appearance": 1,
      "appearances": [1, 3, 5],
      "clothing_log": [
        {"scenes": [1, 3], "outfit": "exact outfit description"},
        {"scenes": [5], "outfit": "changed outfit description"}
      ]
    }
  ],

  "summaryPrompt": "markdown with ### Style and ### Cinematography sections. Style: **Visual Texture**, **Lighting Quality**, **Color Palette**, **Atmosphere**. Cinematography: **Camera**, **Lens**, **Lighting Setup**, **Mood**. Every bullet = concrete technical description.",

  "scenes": [
    {
      "scene_number": 1,
      "timestamp_start": "00:00.000",
      "timestamp_end": "00:02.500",
      "duration": 2.5,
      "scene_type": "hook",
      "mood": "mysterious",
      "narrative_purpose": "hook - grab attention",
      "title": "precise description of this visible beat",

      "image_prompt": "SELF-CONTAINED forensic image prompt (MIN 150 WORDS): 9:16 vertical, art style, FULL character anchors, environment, framing, lighting, color palette, props, mood. Zero vague sentences.",

      "animation_prompt": "COMPLETE motion prompt (MIN 120 WORDS): movement paths, expressions, camera movement, duration, transition, speaker blocking with ⚠️ warnings.",

      "voiceover": {
        "text": "Speaker-labeled dialogue lines in Darija",
        "language": "darija",
        "speaker": "CHAR_01",
        "emotion": "excited",
        "delivery_notes": "fast-paced, loud"
      },

      "sound_design": {
        "music": "genre, tempo, mood, instruments",
        "sfx": ["footsteps", "door slam"],
        "ambient": "city traffic, distant voices",
        "transition": "hard cut"
      },

      "camera": {
        "angle": "close-up",
        "movement": "slow zoom in",
        "lens_style": "shallow depth of field"
      },

      "text_overlay": {
        "text": "on-screen text if any",
        "position": "center",
        "font_style": "bold sans-serif",
        "color": "#FFFFFF",
        "animation": "fade in"
      }
    }
  ]
}

The scenes array must contain as many objects as the video content requires. Do NOT skip any scene. Do NOT cap it artificially.`,
              },
              ...frames,
            ],
          },
        ],
        max_completion_tokens: 32000,
      }),
    }).finally(() => clearTimeout(timeoutId));
  };

  let response = await sendAnalysisRequest(frameInputs.frames);

  if (!response.ok) {
    const errorText = await response.text();
    if (isImageProcessingServerError(errorText) && input.videoFrames.length > 8) {
      const retryFrames = buildFrameInputs(input.videoFrames, 12, "low");
      response = await sendAnalysisRequest(
        retryFrames,
        "\n- This is a retry with fewer sampled frames because the first image processing attempt failed internally. Use these fewer frames plus the transcript to preserve the same beginning-to-end story flow as much as possible.",
      );

      if (response.ok) {
        const result = await normalizeVideoAnalysisResponse(await response.json(), baseUrl, apiKey, input);
        const validation = validateAnalysisOutput(result, detectedSceneCount, videoDuration);
        result.qualityScore = validation.qualityScore;
        result.validationIssues = validation.issues.length > 0 ? validation.issues : null;
        result.retryCount = 1;
        return result;
      }

      const retryErrorText = await response.text();
      throw new Error(`AI video analysis failed after retry: ${retryErrorText.slice(0, 500)}`);
    }

    throw new Error(`AI video analysis failed: ${errorText.slice(0, 500)}`);
  }

  let result = await normalizeVideoAnalysisResponse(await response.json(), baseUrl, apiKey, input);
  let validation = validateAnalysisOutput(result, detectedSceneCount, videoDuration);
  let retryCount = 0;

  // Auto-retry on critical validation failure (up to 2 retries)
  const sceneTimestamps = sceneDetection?.sceneTimestamps ?? [];
  if (validation.severity === "critical" && detectedSceneCount > 0) {
    // Attempt 2: Targeted retry — tell AI exactly which timestamps were missed
    retryCount++;
    const targetedPrompt = buildTargetedRetryPrompt(result, validation, sceneTimestamps, videoDuration);
    const retryResponse = await sendAnalysisRequest(frameInputs.frames, targetedPrompt);

    if (retryResponse.ok) {
      const retryResult = await normalizeVideoAnalysisResponse(await retryResponse.json(), baseUrl, apiKey, input);
      const retryValidation = validateAnalysisOutput(retryResult, detectedSceneCount, videoDuration);

      if (retryValidation.qualityScore > validation.qualityScore) {
        result = retryResult;
        validation = retryValidation;
      }
    }

    // Attempt 3 if still critical: minimal scene-focused prompt
    if (validation.severity === "critical") {
      retryCount++;
      const simplifiedResponse = await sendAnalysisRequest(
        frameInputs.frames,
        `\n\n⚠️ FINAL RETRY — Previous attempts failed quality checks.\n\nSIMPLIFIED TASK: Return ${detectedSceneCount} scenes minimum.\nRequired timestamps: ${sceneTimestamps.map((t) => t.toFixed(1) + "s").join(", ")}\n\nFor EACH timestamp create a scene with:\n- image_prompt (80+ words minimum)\n- animation_prompt\n- scene_type\n- timestamp_start and timestamp_end\n\nSkip character registry and sound design — scene coverage is the priority.\nReturn ONLY valid JSON.`,
      );

      if (simplifiedResponse.ok) {
        const simplifiedResult = await normalizeVideoAnalysisResponse(await simplifiedResponse.json(), baseUrl, apiKey, input);
        const simplifiedValidation = validateAnalysisOutput(simplifiedResult, detectedSceneCount, videoDuration);

        if (simplifiedValidation.qualityScore > validation.qualityScore) {
          result = simplifiedResult;
          validation = simplifiedValidation;
        }
      }
    }
  }

  result.qualityScore = validation.qualityScore;
  result.validationIssues = validation.issues.length > 0 ? validation.issues : null;
  result.retryCount = retryCount > 0 ? retryCount : null;
  return result;
}

export async function buildAIUrlOnlyPromptPack(input: {
  niche: Niche;
  concept: string;
  reelUrl: string;
  reelNotes: string;
  systemPromptOverride?: string;
  modelOverride?: string | null;
}): Promise<GeneratedPromptPack & { downloadedFromUrl?: boolean }> {
  const { downloadAndExtractVideo, videoFileToDataUrl } = await import("./video-downloader.js");

  let downloaded;
  try {
    downloaded = await downloadAndExtractVideo(input.reelUrl);
  } catch {
    return buildAIUrlTextOnlyPromptPack(input);
  }

  try {
    let videoDataUrl: string | undefined;
    try {
      const fileSizeMb = (await (await import("node:fs/promises")).stat(downloaded.videoPath)).size / (1024 * 1024);
      if (fileSizeMb <= 55) {
        videoDataUrl = await videoFileToDataUrl(downloaded.videoPath);
      }
    } catch {
    }

    const result = await buildAIVideoPromptPack({
      niche: input.niche,
      concept: input.concept,
      reelNotes: input.reelNotes,
      videoFrames: downloaded.frames,
      videoDataUrl,
      systemPromptOverride: input.systemPromptOverride,
      modelOverride: input.modelOverride,
    });

    return { ...result, downloadedFromUrl: true };
  } finally {
    await downloaded.cleanup();
  }
}

async function buildAIUrlTextOnlyPromptPack(input: {
  niche: Niche;
  concept: string;
  reelUrl: string;
  reelNotes: string;
  systemPromptOverride?: string;
  modelOverride?: string | null;
}): Promise<GeneratedPromptPack> {
  const { baseUrl, apiKey, modelId: defaultModel } = await resolveAiConfig("video-analysis");

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.modelOverride?.trim() || defaultModel,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: input.systemPromptOverride ??
            "You are an elite video-to-prompt engineer specializing in Moroccan social media content. Your job is to create detailed, copy-ready production briefs from a video URL and description. You write prompts for AI video generators (Kling, Sora, Runway, Pika). Every prompt must be cinematographically precise. Dialogue must be in natural Moroccan Darija (Arabic script). Return strict JSON only.",
        },
        {
          role: "user",
          content: `Create a complete production prompt pack based on the following video link and description. Since no video frames are available, use the provided context to imagine and design a high-quality, coherent video concept that would work well as a Moroccan social media reel.

═══════════════════════════════════
SOURCE INFORMATION
═══════════════════════════════════
- Video URL: ${input.reelUrl}
- Concept / Title: ${input.concept}
- Niche: ${input.niche.name}
- Target audience: ${input.niche.audience ?? "Moroccan social media users"}
- Content angle: ${input.niche.contentAngle ?? "Engaging, relatable content"}
- User notes / description: ${input.reelNotes || "No additional notes provided."}

═══════════════════════════════════
RULES
═══════════════════════════════════
1. Create 3–6 scenes that form a coherent narrative arc (hook → development → resolution).
2. Each imagePrompt must be self-contained (min 100 words), vertical 9:16, with full environment and character descriptions.
3. Each animationPrompt must include movement, camera motion, and emotional arc (min 80 words).
4. voiceOverDarija must be in natural Moroccan Darija Arabic script. Use labeled speaker turns.
5. soundEffectsPrompt must include music genre, ambience, and specific sound effects.

═══════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════
Return JSON with exactly these keys:

{
  "title": "short descriptive title for this video concept",
  "summaryPrompt": "markdown with ### Style and ### Cinematography bullet sections",
  "scenes": [
    {
      "title": "scene beat description",
      "imagePrompt": "SELF-CONTAINED English image prompt (min 100 words): 9:16 vertical, art style, full character/environment description, camera framing, lighting, color palette",
      "animationPrompt": "COMPLETE English animation prompt (min 80 words): subject movement, camera motion, transitions, emotional arc",
      "voiceOverDarija": "Moroccan Darija dialogue, labeled by speaker role",
      "soundEffectsPrompt": "English sound design brief: music, ambience, sfx timing"
    }
  ]
}`,
        },
      ],
      max_completion_tokens: 12000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI URL analysis failed: ${errorText.slice(0, 500)}`);
  }

  return normalizeVideoAnalysisResponse(await response.json(), baseUrl, apiKey, input);
}

function pickFrameForScene(frames: string[], sceneIndex: number, totalScenes: number): string | null {
  if (!frames.length) return null;
  const idx = Math.min(
    Math.round(((sceneIndex + 0.5) / totalScenes) * frames.length),
    frames.length - 1,
  );
  return frames[idx] ?? null;
}

async function normalizeVideoAnalysisResponse(
  responseJson: unknown,
  baseUrl: string,
  apiKey: string,
  input: {
    niche: Niche;
    videoFrames?: string[];
  },
): Promise<GeneratedPromptPack> {
  const payload = responseJson as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI video analysis returned an empty response.");
  }

  type RawScene = {
    title?: string;
    scene_number?: number;
    sceneNumber?: number;
    scene_type?: string;
    sceneType?: string;
    timestamp_start?: string;
    timestampStart?: string;
    timestamp_end?: string;
    timestampEnd?: string;
    duration?: number;
    mood?: string;
    narrative_purpose?: string;
    narrativePurpose?: string;
    image_prompt?: string;
    imagePrompt?: string;
    animation_prompt?: string;
    animationPrompt?: string;
    voiceover?: VoiceoverData | string;
    voiceOverDarija?: string;
    voice_over_darija?: string;
    sound_design?: SoundDesignData;
    soundDesign?: SoundDesignData;
    soundEffectsPrompt?: string;
    sound_effects_prompt?: string;
    camera?: CameraData;
    text_overlay?: TextOverlayData;
    textOverlay?: TextOverlayData;
  };

  type RawCharacter = {
    id?: string;
    description?: string;
    first_appearance?: number;
    firstAppearance?: number;
    appearances?: number[];
    clothing_log?: Array<{ scenes: number[]; outfit: string }>;
    clothingLog?: Array<{ scenes: number[]; outfit: string }>;
  };

  const parsed = (await parseOrRepairJsonObject(content, baseUrl, apiKey)) as {
    title?: string;
    summaryPrompt?: string;
    summary_prompt?: string;
    detected_language?: string;
    detectedLanguage?: string;
    total_scenes?: number;
    totalScenes?: number;
    duration_seconds?: number;
    durationSeconds?: number;
    aspect_ratio?: string;
    aspectRatio?: string;
    overall_style?: string;
    overallStyle?: string;
    color_grading?: string;
    colorGrading?: string;
    mood_progression?: string;
    moodProgression?: string;
    content_category?: string;
    contentCategory?: string;
    viral_elements?: string[];
    viralElements?: string[];
    characters?: RawCharacter[];
    scenes?: RawScene[];
  };

  if (!Array.isArray(parsed.scenes) || parsed.scenes.length < 1) {
    throw new Error("AI video analysis did not return any scenes.");
  }

  const normalizedCharacters: CharacterData[] | null = parsed.characters
    ? parsed.characters.map((c) => ({
        id: c.id || "CHAR_UNKNOWN",
        description: c.description || "",
        firstAppearance: c.first_appearance ?? c.firstAppearance,
        appearances: c.appearances,
        clothingLog: c.clothing_log ?? c.clothingLog,
      }))
    : null;

  const defaultSummary = `### Style\n* **Visual Texture:** AI analyzed the uploaded video frames and generated a direct recreation brief from the visible content.\n* **Lighting Quality:** Match the lighting visible in the source frames.\n* **Color Palette:** Match the colors visible in the source frames.\n* **Atmosphere:** Preserve the source video's mood.\n\n### Cinematography\n* **Camera:** Match the source framing and camera movement.\n* **Lens:** Match the source perspective.\n* **Lighting:** Match the source lighting direction and intensity.\n* **Mood:** Preserve the source visual emotion.`;

  return {
    title: truncateGeneratedText(parsed.title || `${input.niche.name}: analyzed reel prompt pack`, 120),
    summaryPrompt: truncateGeneratedText(
      parsed.summaryPrompt ?? parsed.summary_prompt ?? defaultSummary,
      5000,
    ),
    detectedLanguage: parsed.detected_language ?? parsed.detectedLanguage ?? null,
    totalScenes: parsed.total_scenes ?? parsed.totalScenes ?? parsed.scenes.length,
    durationSeconds: parsed.duration_seconds ?? parsed.durationSeconds ?? null,
    aspectRatio: parsed.aspect_ratio ?? parsed.aspectRatio ?? null,
    overallStyle: parsed.overall_style ?? parsed.overallStyle ?? null,
    colorGrading: parsed.color_grading ?? parsed.colorGrading ?? null,
    moodProgression: parsed.mood_progression ?? parsed.moodProgression ?? null,
    contentCategory: parsed.content_category ?? parsed.contentCategory ?? null,
    viralElements: parsed.viral_elements ?? parsed.viralElements ?? null,
    characters: normalizedCharacters,
    scenes: parsed.scenes.map((scene, index) => {
      const title = truncateGeneratedText(scene.title || (index === 0 ? "Hook from analyzed reel" : `Scene ${index + 1}`), 160);
      const frames = input.videoFrames ?? [];

      // Normalize voiceover: can be an object or a string
      const rawVoiceover = scene.voiceover;
      let voiceoverObj: VoiceoverData | null = null;
      let voiceOverDarijaStr: string;
      if (rawVoiceover && typeof rawVoiceover === "object") {
        const rv = rawVoiceover as Record<string, unknown>;
        voiceoverObj = {
          text: (rv.text as string) || "",
          language: (rv.language as string | undefined),
          speaker: (rv.speaker as string | undefined),
          emotion: (rv.emotion as string | undefined),
          deliveryNotes: (rv.deliveryNotes ?? rv.delivery_notes) as string | undefined,
        };
        voiceOverDarijaStr = normalizeDialogueBlock(
          (rv.text as string) || scene.voiceOverDarija || scene.voice_over_darija,
          "No clear dialogue heard in this scene.",
        );
      } else {
        voiceOverDarijaStr = normalizeDialogueBlock(
          scene.voiceOverDarija || scene.voice_over_darija || (typeof rawVoiceover === "string" ? rawVoiceover : undefined),
          "No clear dialogue heard in this scene.",
        );
      }

      // Normalize sound design: object or string fallback
      const rawSoundDesign = scene.sound_design ?? scene.soundDesign;
      const soundDesignObj: SoundDesignData | null = rawSoundDesign
        ? {
            music: rawSoundDesign.music,
            sfx: rawSoundDesign.sfx,
            ambient: rawSoundDesign.ambient,
            transition: rawSoundDesign.transition,
          }
        : null;

      const soundEffectsStr = rawSoundDesign
        ? [
            rawSoundDesign.music ? `Music: ${rawSoundDesign.music}` : null,
            rawSoundDesign.sfx?.length ? `SFX: ${rawSoundDesign.sfx.join(", ")}` : null,
            rawSoundDesign.ambient ? `Ambient: ${rawSoundDesign.ambient}` : null,
            rawSoundDesign.transition ? `Transition: ${rawSoundDesign.transition}` : null,
          ].filter(Boolean).join(". ") || "Minimal ambient sound."
        : requireGeneratedText(
            scene.soundEffectsPrompt || scene.sound_effects_prompt,
            "sound prompt",
            "Use background sound and music that match the audible mood of this moment.",
          );

      const sceneType = scene.scene_type ?? scene.sceneType ?? (index === 0 ? "hook" : "scene");

      return {
        sceneNumber: index + 1,
        sceneType,
        title,
        imagePrompt: requireGeneratedText(
          scene.image_prompt ?? scene.imagePrompt,
          "image prompt",
          `Vertical 9:16 image-generation prompt. Recreate this visible beat: ${title}.`,
        ),
        animationPrompt: requireGeneratedText(
          scene.animation_prompt ?? scene.animationPrompt,
          "animation prompt",
          `Animate this beat with camera movement and character action: ${title}.`,
        ),
        voiceOverDarija: voiceOverDarijaStr,
        soundEffectsPrompt: soundEffectsStr,
        sceneFrameUrl: pickFrameForScene(frames, index, parsed.scenes!.length),
        timestampStart: scene.timestamp_start ?? scene.timestampStart ?? null,
        timestampEnd: scene.timestamp_end ?? scene.timestampEnd ?? null,
        duration: scene.duration ?? null,
        mood: scene.mood ?? null,
        narrativePurpose: scene.narrative_purpose ?? scene.narrativePurpose ?? null,
        camera: scene.camera
          ? {
              angle: scene.camera.angle,
              movement: scene.camera.movement,
              lensStyle: (scene.camera.lensStyle ?? (scene.camera as Record<string, unknown>).lens_style) as string | undefined,
            }
          : null,
        voiceover: voiceoverObj,
        soundDesign: soundDesignObj,
        textOverlay: (() => {
          const raw = scene.text_overlay ?? scene.textOverlay;
          if (!raw) return null;
          const r = raw as Record<string, unknown>;
          return {
            text: r.text as string | undefined,
            position: r.position as string | undefined,
            fontStyle: (r.fontStyle ?? r.font_style) as string | undefined,
            color: r.color as string | undefined,
            animation: r.animation as string | undefined,
          };
        })(),
      };
    }),
  };
}

function buildFrameInputs(videoFrames: string[], limit: number, detail: "high" | "low") {
  const selectedFrames = selectEvenlySpacedItems(videoFrames, Math.min(limit, videoFrames.length));

  return selectedFrames.map((frame) => ({
    type: "image_url" as const,
    image_url: {
      url: frame,
      detail,
    },
  }));
}

/**
 * Smart frame selection that prioritizes scene-change frames.
 * Combines scene-change timestamps from FFmpeg with evenly-spaced browser-extracted frames.
 */
function buildSmartFrameInputs(
  videoFrames: string[],
  sceneTimestamps: number[],
  durationSeconds: number,
  limit: number,
  detail: "high" | "low",
): {
  frames: { type: "image_url"; image_url: { url: string; detail: "high" | "low" } }[];
  timestamps: number[];
  sceneChangeFlags: boolean[];
} {
  if (videoFrames.length === 0) {
    return { frames: [], timestamps: [], sceneChangeFlags: [] };
  }

  // If no scene detection data, fall back to evenly-spaced selection
  if (sceneTimestamps.length === 0 || durationSeconds <= 0) {
    const selected = selectEvenlySpacedItems(videoFrames, Math.min(limit, videoFrames.length));
    return {
      frames: selected.map((frame) => ({ type: "image_url" as const, image_url: { url: frame, detail } })),
      timestamps: selected.map((_, i) => (durationSeconds > 0 ? (i / Math.max(selected.length - 1, 1)) * durationSeconds : i)),
      sceneChangeFlags: selected.map(() => false),
    };
  }

  // Map each frame to its estimated timestamp based on even distribution
  const frameTimestamps = videoFrames.map((_, i) =>
    (i / Math.max(videoFrames.length - 1, 1)) * durationSeconds,
  );

  // Find the closest frame to each scene-change timestamp
  const sceneChangeFrameIndices = new Set<number>();
  for (const sceneTs of sceneTimestamps) {
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < frameTimestamps.length; i++) {
      const dist = Math.abs(frameTimestamps[i] - sceneTs);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    sceneChangeFrameIndices.add(closestIdx);
  }

  // Build selection: scene-change frames are mandatory, fill rest with evenly spaced
  const sceneIndices = Array.from(sceneChangeFrameIndices).sort((a, b) => a - b);
  const remaining = limit - sceneIndices.length;

  let selectedIndices: number[];
  if (remaining <= 0) {
    // Too many scene changes — take evenly spaced subset of scene frames
    selectedIndices = selectEvenlySpacedItems(sceneIndices, limit);
  } else {
    // Fill gaps with non-scene frames, ensuring no gap > 2 seconds
    const nonSceneIndices: number[] = [];
    for (let i = 0; i < videoFrames.length; i++) {
      if (!sceneChangeFrameIndices.has(i)) nonSceneIndices.push(i);
    }
    const fillers = selectEvenlySpacedItems(nonSceneIndices, remaining);
    selectedIndices = [...new Set([...sceneIndices, ...fillers])].sort((a, b) => a - b);

    // Ensure no gap > 2 seconds
    const maxGapFrames = Math.ceil(2 / (durationSeconds / videoFrames.length));
    const filled: number[] = [...selectedIndices];
    for (let i = 0; i < filled.length - 1; i++) {
      const gap = filled[i + 1] - filled[i];
      if (gap > maxGapFrames) {
        const mid = Math.round((filled[i] + filled[i + 1]) / 2);
        if (!filled.includes(mid)) filled.push(mid);
      }
    }
    selectedIndices = [...new Set(filled)].sort((a, b) => a - b);

    // Cap at limit
    if (selectedIndices.length > limit) {
      // Keep all scene frames, reduce fillers
      const sceneSet = new Set(sceneIndices);
      const keptScene = selectedIndices.filter((i) => sceneSet.has(i));
      const keptOther = selectedIndices.filter((i) => !sceneSet.has(i));
      const trimmedOther = selectEvenlySpacedItems(keptOther, limit - keptScene.length);
      selectedIndices = [...new Set([...keptScene, ...trimmedOther])].sort((a, b) => a - b);
    }
  }

  return {
    frames: selectedIndices.map((i) => ({
      type: "image_url" as const,
      image_url: { url: videoFrames[i], detail },
    })),
    timestamps: selectedIndices.map((i) => frameTimestamps[i]),
    sceneChangeFlags: selectedIndices.map((i) => sceneChangeFrameIndices.has(i)),
  };
}

function selectEvenlySpacedItems<T>(items: T[], count: number) {
  if (items.length <= count) {
    return items;
  }

  return Array.from({ length: count }, (_, index) => {
    const sourceIndex = Math.round((index / Math.max(count - 1, 1)) * (items.length - 1));
    return items[sourceIndex];
  });
}

function isImageProcessingServerError(errorText: string) {
  return (
    errorText.includes("image_moderation_server_error") ||
    errorText.includes("Something went wrong processing one of your images")
  );
}

function parseJsonObject(value: string) {
  let trimmed = value.trim();

  // Handle two-stage system prompt output: Stage 1 (markdown) + separator + Stage 2 (JSON)
  // The separator is "---JSON-OUTPUT-BELOW---" (may have surrounding whitespace/dashes)
  const separatorMatch = trimmed.match(/---+\s*JSON[- _]OUTPUT[- _]BELOW\s*---+/i);
  if (separatorMatch && separatorMatch.index !== undefined) {
    trimmed = trimmed.slice(separatorMatch.index + separatorMatch[0].length).trim();
  }

  const unfenced = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(unfenced);
}

async function parseOrRepairJsonObject(value: string, baseUrl: string, apiKey: string) {
  try {
    return parseJsonObject(value);
  } catch {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You repair malformed or truncated JSON into valid JSON only. Preserve all usable content. If a scene is incomplete, finish it briefly. Return no markdown and no explanation.",
          },
          {
            role: "user",
            content: `Repair this malformed video-to-prompt JSON into valid JSON with keys title, summaryPrompt, scenes. Each scene must have title, imagePrompt, animationPrompt, voiceOverDarija, soundEffectsPrompt. Keep content concise:\n\n${value.slice(0, 30000)}`,
          },
        ],
        max_completion_tokens: 12000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI video analysis JSON repair failed: ${errorText.slice(0, 500)}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const repaired = payload.choices?.[0]?.message?.content;

    if (!repaired) {
      throw new Error("AI video analysis returned malformed JSON and repair returned an empty response.");
    }

    return parseJsonObject(repaired);
  }
}

function requireGeneratedText(value: unknown, label: string, fallback?: string) {
  if (typeof value !== "string" || value.trim().length < 8) {
    if (fallback) {
      return fallback;
    }
    throw new Error(`AI video analysis returned an invalid ${label}.`);
  }

  return value.trim();
}

function normalizeDialogueBlock(value: unknown, fallback: string) {
  if (Array.isArray(value)) {
    const lines = value
      .map((line) => {
        if (typeof line === "string") return line.trim();
        if (line && typeof line === "object") {
          const record = line as Record<string, unknown>;
          const speaker = typeof record["speaker"] === "string" ? record["speaker"].trim() : "";
          const text =
            typeof record["text"] === "string"
              ? record["text"].trim()
              : typeof record["line"] === "string"
                ? record["line"].trim()
                : "";
          if (speaker && text) return `${speaker}: "${text.replace(/^"|"$/g, "")}"`;
          return text;
        }
        return "";
      })
      .filter((line) => line.length >= 3);

    if (lines.length > 0) {
      return truncateGeneratedText(lines.join("\n"), 5000);
    }
  }

  if (typeof value !== "string" || value.trim().length < 8) {
    return fallback;
  }

  return truncateGeneratedText(value.trim(), 5000);
}

function truncateGeneratedText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

/**
 * Transcribe video audio with segment-level timestamps.
 * Falls back to raw text transcription if verbose_json is not supported.
 */
async function transcribeVideoAudioWithSegments(
  videoDataUrl: string,
  baseUrl: string,
  apiKey: string,
): Promise<{ text: string | null; segments: TranscriptionSegment[] }> {
  const parsed = parseDataUrl(videoDataUrl);
  const workspace = path.join(tmpdir(), `reel-audio-${randomUUID()}`);
  const inputPath = path.join(workspace, `source.${extensionForMime(parsed.mimeType)}`);
  const audioPath = path.join(workspace, "audio.wav");

  await mkdir(workspace, { recursive: true });

  try {
    await writeFile(inputPath, parsed.buffer);
    try {
      await execFileAsync("ffmpeg", ["-y", "-i", inputPath, "-vn", "-ac", "1", "-ar", "16000", "-t", "600", audioPath], {
        timeout: 120000,
      });
    } catch {
      return { text: "No usable audio track was detected in the uploaded video.", segments: [] };
    }

    const audioBuffer = await readFile(audioPath);
    if (audioBuffer.byteLength < 1024) {
      return { text: "No usable audio track was detected in the uploaded video.", segments: [] };
    }

    // Try verbose_json first for segment timestamps
    const formData = new FormData();
    formData.append("model", "gpt-4o-mini-transcribe");
    formData.append("file", new Blob([audioBuffer], { type: "audio/wav" }), "audio.wav");
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "segment");

    const transcribeController = new AbortController();
    const transcribeTimeout = setTimeout(() => transcribeController.abort(), 60 * 1000);
    let response = await fetch(`${baseUrl.replace(/\/$/, "")}/audio/transcriptions`, {
      method: "POST",
      signal: transcribeController.signal,
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    }).finally(() => clearTimeout(transcribeTimeout));

    if (response.ok) {
      const payload = (await response.json()) as {
        text?: string;
        segments?: Array<{ start: number; end: number; text: string; avg_logprob?: number }>;
      };

      if (payload.segments && payload.segments.length > 0) {
        const segments: TranscriptionSegment[] = payload.segments.map((seg) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text.trim(),
          language: detectSegmentLanguage(seg.text),
        }));
        return { text: payload.text?.trim() || null, segments };
      }

      return { text: payload.text?.trim() || null, segments: [] };
    }

    // Fallback: try plain json format
    const fallbackFormData = new FormData();
    fallbackFormData.append("model", "gpt-4o-mini-transcribe");
    fallbackFormData.append("file", new Blob([audioBuffer], { type: "audio/wav" }), "audio.wav");
    fallbackFormData.append("response_format", "json");

    const fallbackController = new AbortController();
    const fallbackTimeout = setTimeout(() => fallbackController.abort(), 60 * 1000);
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/audio/transcriptions`, {
      method: "POST",
      signal: fallbackController.signal,
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fallbackFormData,
    }).finally(() => clearTimeout(fallbackTimeout));

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Audio transcription failed: ${errorText.slice(0, 500)}`);
    }

    const payload = (await response.json()) as { text?: string };
    return {
      text: payload.text?.trim() || "The audio track was present, but no clear speech was transcribed.",
      segments: [],
    };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

// 150+ Darija markers covering common expressions, verbs, adjectives, pronouns,
// quantifiers, slang, and Casablanca/Rabat-style online vocabulary.
const DARIJA_MARKERS = new Set([
  // Greetings & common expressions
  "salam", "labas", "mzyan", "bghit", "walo", "bzzaf", "bzaf",
  "dyal", "dyali", "dyalna", "dyalha", "dyalkom", "dyalhom",
  "rah", "kayn", "makaynch", "wash", "wach", "wakha", "yallah",
  "hadchi", "hadak", "hadik", "hada", "hadi", "hado", "hadouk",
  "fach", "machi", "mashi", "bach", "ghi", "gha", "ghadi",
  "nta", "nti", "ntoma", "howa", "hiya", "homa",
  "ana", "hnaya", "tma", "fin", "kifach", "mnin",
  "3lach", "3la", "fhad", "hna",
  // Verbs (common Darija)
  "gal", "galt", "galo", "ja", "jat", "jaw",
  "msha", "mshat", "msho", "dar", "dart", "daro",
  "kan", "kanet", "kano", "bda", "bdat", "bdaw",
  "wqf", "sifet", "jab", "kla", "shreb", "nna",
  "fhem", "3ref", "sme3", "chaf", "gls", "nod",
  "rj3", "khrej", "dkhel", "hab", "bghiti", "fham",
  "katban", "tbedel", "chouf", "khas",
  // Adjectives & descriptors
  "kbir", "sghir", "zwine", "kbira", "mzyana",
  "bhal", "kima", "hit", "ghir", "3ad", "daba",
  "men3d", "qdim", "jdid", "hsen", "khayb",
  "mhemm", "sahel", "s3ib", "rkhis", "ghali",
  // Numbers & quantifiers (Moroccan style)
  "wahed", "jouj", "tlata", "rb3a", "khmsa",
  "setta", "sb3a", "tmnya", "ts3ud", "3ashra",
  "chwiya", "noss", "kolchi",
  // Pronouns & particles
  "dial", "lhaja", "chkon", "fikra", "lmochkil",
  "hadak", "dik", "dak", "hak", "chno", "achno",
  "ash", "aash", "lla", "naam", "bla", "bla",
  // Moroccan slang (common online)
  "khouya", "khti", "aji", "sir", "sahbi", "lwalid",
  "lwalida", "drari", "bnat", "wlad", "zwin", "zwina",
  "3awed", "bsahtek", "tawba", "inshallah", "bismillah",
  "hamdullah", "subhanallah", "mashallah",
  // Additional common Darija
  "walakin", "ila", "amma", "walaynni", "7it",
  "dima", "b7al", "mn", "li", "fih", "fiha",
  "3ndek", "3ndi", "3ndna", "3ndhom", "mgharba",
  "flous", "khedma", "lkhbar", "lqadia", "chi",
  "matalan", "ya3ni", "khlass", "safi", "baraka",
  "zid", "ziid", "3tini", "golha", "bghina",
]);

const FRENCH_MARKERS = /\b(je|tu|il|elle|nous|vous|ils|elles|les|des|pour|avec|dans|sur|que|qui|est|sont|mais|ou|et|donc|car|ni|puis|comme|très|bien|bon|jour|merci|oui|non|pas|plus|aussi|encore|ici|maintenant|toujours|jamais|rien|tout|peu|beaucoup|entre|chez|sans|vers|après|avant|pendant|depuis|parce|quand|comment|pourquoi|combien|cette|cette|ces|mon|ton|son|notre|votre|leur|faire|avoir|être|aller|venir|voir|savoir|pouvoir|vouloir|devoir|falloir|dire|donner|prendre|mettre|trouver|passer|regarder|aimer|croire|demander|rester|répondre|entendre|penser|arriver|connaître|devenir|sentir|attendre|vivre|chercher|sortir|comprendre|porter|perdre|commencer)\b/i;

function detectSegmentLanguage(text: string): string {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return "other";

  const darijaCount = words.filter((w) => DARIJA_MARKERS.has(w)).length;
  const hasArabicScript = /[\u0600-\u06FF]/.test(text);
  const frenchMatches = text.match(FRENCH_MARKERS);
  const frenchCount = frenchMatches ? frenchMatches.length : 0;

  const darijaRatio = darijaCount / words.length;
  const frenchRatio = frenchCount / words.length;

  // Code-switching detection using ratios
  if (darijaCount > 0 && frenchCount > 0) {
    if (darijaRatio > 0.4) return "darija";
    return "mixed_darija_french";
  }
  if (darijaCount > 0) return "darija";
  if (hasArabicScript && frenchCount > 0) return "mixed_arabic_french";
  if (hasArabicScript) return "arabic";
  if (frenchRatio > 0.3) return "french";
  return "other";
}

function buildStructuredTranscription(segments: TranscriptionSegment[], sceneTimestamps: number[]): string {
  if (segments.length === 0) return "No usable speech transcript was extracted.";

  const lines: string[] = ["=== AUDIO TRANSCRIPTION (with timestamps) ==="];

  // Find gaps between segments (potential silence/music)
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // Check for silence gap before this segment
    const prevEnd = i > 0 ? segments[i - 1].end : 0;
    if (seg.start - prevEnd > 1.5) {
      lines.push(`[${formatTimestamp(prevEnd)} → ${formatTimestamp(seg.start)}] [SILENCE/MUSIC]`);
    }

    const langTag = seg.language.toUpperCase();
    lines.push(`[${formatTimestamp(seg.start)} → ${formatTimestamp(seg.end)}] [${langTag}] ${seg.text}`);
  }

  lines.push("===");
  return lines.join("\n");
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${secs.toFixed(1).padStart(4, "0")}`;
}

function validateAnalysisOutput(
  result: GeneratedPromptPack,
  expectedMinScenes: number,
  videoDuration: number,
): ValidationResult {
  const issues: string[] = [];

  // Critical checks
  if (!result.scenes || result.scenes.length === 0) {
    issues.push("CRITICAL: No scenes returned");
  } else if (expectedMinScenes > 0 && result.scenes.length < expectedMinScenes * 0.5) {
    issues.push(`CRITICAL: Only ${result.scenes.length} scenes returned, expected ~${expectedMinScenes}`);
  }

  // Warning checks per scene
  if (result.scenes) {
    for (let i = 0; i < result.scenes.length; i++) {
      const scene = result.scenes[i];
      if (!scene.imagePrompt || scene.imagePrompt.split(/\s+/).length < 30) {
        issues.push(`WARNING: Scene ${i + 1} has weak image prompt (${scene.imagePrompt?.split(/\s+/).length ?? 0} words)`);
      }
      if (!scene.timestampStart) {
        issues.push(`WARNING: Scene ${i + 1} missing timestamp`);
      }
    }

    // Timestamp continuity
    for (let i = 1; i < result.scenes.length; i++) {
      const prevEnd = parseTimestampToSeconds(result.scenes[i - 1].timestampEnd);
      const currStart = parseTimestampToSeconds(result.scenes[i].timestampStart);
      if (prevEnd !== null && currStart !== null && currStart - prevEnd > 3.0) {
        issues.push(`WARNING: Large gap between scene ${i} and ${i + 1}: ${(currStart - prevEnd).toFixed(1)}s`);
      }
    }
  }

  // Calculate quality score
  const qualityScore = calculateQualityScore(result, expectedMinScenes);
  const hasCritical = issues.some((i) => i.startsWith("CRITICAL"));

  return {
    passed: !hasCritical,
    issues,
    severity: hasCritical ? "critical" : issues.length > 0 ? "warning" : "ok",
    qualityScore,
  };
}

function calculateQualityScore(result: GeneratedPromptPack, expectedScenes: number): number {
  let score = 0;
  const scenes = result.scenes ?? [];

  // === Scene Coverage (25 pts) — proportional to expected count ===
  const expected = Math.max(1, expectedScenes);
  const coverageRatio = Math.min(1, scenes.length / expected);
  score += Math.round(coverageRatio * 25);

  // === Prompt Quality (35 pts) — depth of image prompts ===
  if (scenes.length > 0) {
    const promptScores = scenes.map((scene) => {
      let s = 0;
      const prompt = (scene.imagePrompt ?? "").toLowerCase();
      const wordCount = prompt.split(/\s+/).length;

      // Word count (0-15 pts)
      s += Math.min(15, Math.floor(wordCount / 8));

      // Has environment description (0-5 pts)
      if (/\b(indoor|outdoor|room|street|background|location|setting|environment|studio|house|city|wall|floor|table|desk)\b/.test(prompt)) s += 5;

      // Has lighting description (0-5 pts)
      if (/\b(light|lighting|shadow|bright|dark|warm|cool|sunlight|neon|ambient|glow|dim|illuminate|backlit|silhouette)\b/.test(prompt)) s += 5;

      // Has camera/framing info (0-5 pts)
      if (/\b(close-up|closeup|wide shot|medium shot|angle|perspective|zoom|bokeh|depth of field|bird.?s?.eye|overhead|low.?angle|tracking)\b/.test(prompt)) s += 5;

      // Has character description (0-5 pts)
      if (/\b(wearing|hair|skin|face|expression|eyes|mouth|hands|standing|sitting|looking|smiling|holding)\b/.test(prompt)) s += 5;

      return Math.min(35, s);
    });

    score += Math.round(promptScores.reduce((a, b) => a + b, 0) / promptScores.length);
  }

  // === Timestamp Accuracy (15 pts) ===
  if (scenes.length > 0) {
    const withTimestamps = scenes.filter((s) => s.timestampStart).length;
    score += Math.round((withTimestamps / scenes.length) * 8);

    let gapPenalty = 0;
    for (let i = 1; i < scenes.length; i++) {
      const prevEnd = parseTimestampToSeconds(scenes[i - 1].timestampEnd);
      const currStart = parseTimestampToSeconds(scenes[i].timestampStart);
      if (prevEnd !== null && currStart !== null && currStart - prevEnd > 3) gapPenalty++;
    }
    score += Math.max(0, 7 - gapPenalty);
  }

  // === Rich Metadata (15 pts) ===
  if (result.characters && result.characters.length > 0) score += 5;
  if (result.viralElements && result.viralElements.length > 0) score += 3;
  if (result.moodProgression) score += 2;
  if (result.colorGrading) score += 2;
  if (result.contentCategory) score += 3;

  // === Voiceover & Sound (10 pts) ===
  if (scenes.length > 0) {
    const withVoiceover = scenes.filter((s) => s.voiceover?.text && s.voiceover.text.length > 2).length;
    const withSound = scenes.filter((s) => s.soundDesign?.music || (s.soundDesign?.sfx && s.soundDesign.sfx.length > 0)).length;
    score += Math.round((withVoiceover / scenes.length) * 5);
    score += Math.round((withSound / scenes.length) * 5);
  }

  return Math.min(100, score);
}

function parseTimestampToSeconds(ts: string | null | undefined): number | null {
  if (!ts) return null;
  const match = /^(\d+):(\d+(?:\.\d+)?)$/.exec(ts);
  if (match) return parseInt(match[1]) * 60 + parseFloat(match[2]);
  const num = parseFloat(ts);
  return Number.isFinite(num) ? num : null;
}

function buildTargetedRetryPrompt(
  originalResult: GeneratedPromptPack,
  validationResult: ValidationResult,
  sceneChangeTimestamps: number[],
  videoDuration: number,
): string {
  // Find timestamps with no matching scene in the original result
  const coveredRanges = originalResult.scenes.map((s) => ({
    start: parseTimestampToSeconds(s.timestampStart) ?? 0,
    end: parseTimestampToSeconds(s.timestampEnd) ?? 0,
  }));

  const missedTimestamps = sceneChangeTimestamps.filter(
    (ts) => !coveredRanges.some((r) => ts >= r.start - 0.5 && ts <= r.end + 0.5),
  );

  // Find scenes with weak prompts (under 50 words)
  const weakScenes = originalResult.scenes
    .filter((s) => (s.imagePrompt ?? "").split(/\s+/).length < 50)
    .map((s) => s.sceneNumber);

  const parts = ["\n\n⚠️ ANALYSIS CORRECTION REQUIRED\n"];
  parts.push("Your previous analysis had the following issues:");
  parts.push(validationResult.issues.join("\n"));

  if (missedTimestamps.length > 0) {
    parts.push("\nMISSING SCENES — These timestamps had visual cuts but no scene was created:");
    parts.push(missedTimestamps.map((ts) => `- ${ts.toFixed(1)}s`).join("\n"));
    parts.push("You MUST add scene entries for each of these timestamps.");
  }

  if (weakScenes.length > 0) {
    parts.push(`\nWEAK PROMPTS — Scenes ${weakScenes.join(", ")} have image prompts under 50 words (minimum 80 required).`);
    parts.push("Expand each with: environment + character + lighting + camera framing.");
  }

  parts.push("\nINSTRUCTIONS:");
  parts.push("1. Keep all existing correct scenes unchanged");
  parts.push("2. ADD the missing scenes at the correct timestamps");
  parts.push("3. EXPAND the weak scene prompts");
  parts.push("4. Return the COMPLETE corrected JSON (all scenes, not just new/fixed ones)");
  parts.push(`\nVideo duration: ${videoDuration.toFixed(1)}s`);
  parts.push(`Expected minimum scenes: ${sceneChangeTimestamps.length}`);
  parts.push("\nReturn ONLY valid JSON. No explanation text.");

  return parts.join("\n");
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) {
    throw new Error("Uploaded video audio could not be read because the video payload was invalid.");
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("x-matroska")) return "mkv";
  return "mp4";
}
