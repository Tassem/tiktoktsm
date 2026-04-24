import type { Niche } from "@workspace/db";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { getServiceModel } from "../routes/ai-providers";

const execFileAsync = promisify(execFile);

type GeneratedScene = {
  sceneNumber: number;
  sceneType: "hook" | "scene";
  title: string;
  imagePrompt: string;
  animationPrompt: string;
  voiceOverDarija: string;
  soundEffectsPrompt: string;
  sceneFrameUrl?: string | null;
};

type GeneratedPromptPack = {
  summaryPrompt: string;
  title: string;
  scenes: GeneratedScene[];
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

  // Use low-detail frames to stay within token limits — "high" detail with 32 frames
  // causes timeouts and truncated JSON. 16 low-detail frames give sufficient visual
  // coverage for a 90-second reel (~1 frame every 5-6s) at a fraction of the token cost.
  const frameInputs = buildFrameInputs(input.videoFrames, 16, "low");

  if (frameInputs.length === 0) {
    throw new Error("No video frames were provided for analysis.");
  }

  // Transcription is best-effort — a slow or failed transcription must not block the analysis.
  const audioTranscript = input.videoDataUrl
    ? await transcribeVideoAudio(input.videoDataUrl, baseUrl, apiKey).catch(() => null)
    : null;
  const sendAnalysisRequest = (frames: ReturnType<typeof buildFrameInputs>, retryNote = "") => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5-min hard timeout
    return fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.modelOverride?.trim() || defaultModel,
        // Use response_format: json_object only when the system prompt is single-stage ("Return strict JSON only").
        // If the custom system prompt uses a two-stage approach with "---JSON-OUTPUT-BELOW---", skip it
        // to allow Stage 1 markdown + separator + Stage 2 JSON (our parser handles both cases).
        ...((input.systemPromptOverride ?? "").match(/JSON.OUTPUT.BELOW/i)
          ? {}
          : { response_format: { type: "json_object" } }),
        messages: [
          {
            role: "system",
            content: input.systemPromptOverride ??
              "You are an elite video-to-prompt engineer. Your output is fed directly into AI video generators (Kling, Sora, Runway, Pika). Every prompt you write must be copy-ready with zero ambiguity: a video generator reading your prompt must produce the exact same scene without needing to see the original video. Your most critical responsibility is CHARACTER IDENTITY LOCKING: each character is a fixed entity with a unique visual anchor (gender, size, color, clothing, position). When you assign dialogue, the label before the colon IS a hard lock — only that character's mouth moves for that line, no other character speaks it. Dialogue swapping between husband/wife, father/mother, or any two characters is a fatal error. Write with surgical precision. Return strict JSON only.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze every sampled frame from this video and convert the complete video into a professional, copy-ready production brief. These frames are sampled across the full video duration — use them to reconstruct the full visible flow from beginning to end.

═══════════════════════════════════
ABSOLUTE RULES — NEVER BREAK THESE
═══════════════════════════════════
1. CHARACTER IDENTITY LOCK — FORENSIC PRECISION REQUIRED
   - On first appearance of each character, extract and lock their COMPLETE physical anchor from the frames. Every single visible attribute must be captured.
   - Repeat this FULL physical anchor in EVERY imagePrompt where that character appears — copy it verbatim, never abbreviate.
   - NEVER use vague pronouns like "the character", "the person", "the man", "the woman". Always use the full role label + full description.
   - HAIR LOCK (mandatory — missing hair detail = FAILED prompt):
     • Exact color: use precise names (jet-black, chestnut brown, honey blonde, platinum white, deep auburn, dark brown with highlights, silver-grey — NOT just "black hair" or "brown hair")
     • Length: buzzcut / cropped / ear-length / chin-length / shoulder-length / mid-back / waist-length / shaved-sides with longer top
     • Style/texture: bone-straight / wavy / loose curls / tight coils / afro / braided / tied-back ponytail / messy bun / slicked-back / side-parted
     • Any notable features: hairline shape, bangs, highlights, visible roots
     • For STYLIZED characters (fruit/plant-based): describe the organic material forming the hair (e.g., "crown of deep-green strawberry leaves arranged in a fan shape", "cluster of red maple leaves pinned on top", "smooth bare fruit head with no leaf crown")
   - FACE DESIGN LOCK (mandatory — missing face details = FAILED prompt):
     • EYES: exact color (dark brown, hazel, amber, green, black, light brown), shape (large round anime-style / almond / narrow), size relative to face (large/medium/small), eyelash style (thick/thin/none), any shine or highlight on pupils
     • NOSE: shape (small button / rounded / pointed / flat / broad), size relative to face
     • MOUTH/LIPS: shape (thin / full / small / wide), lip color, expression (neutral / smiling / open / pursed)
     • EYEBROWS: thickness (thick/thin/arched), color, shape
     • FACE SHAPE: round / oval / square / heart-shaped / elongated
     • DISTINGUISHING MARKS (critical — do NOT skip if visible): any scars (location on face + shape + color), moles or beauty marks (exact position: left cheek / upper lip / etc.), freckles, birthmarks, bruises, cuts, or any other permanent or temporary mark on skin
     • For STYLIZED/ANIMATED characters: describe face surface (smooth glossy skin / clay matte / plastic sheen), whether eyes are painted on or 3D raised, any texture on cheeks
   - SKIN TONE LOCK: Use precise descriptors — fair/ivory, light beige, warm olive, medium tan, golden brown, caramel, warm brown, dark brown, deep ebony. Never just "light" or "dark".
   - CLOTHING LOCK: Never write "blue shirt". Write "slim-fit navy-blue cotton polo shirt with white stitching on the collar". Include: exact color name, garment type, fit (loose/fitted/oversized/cropped), visible pattern or texture, any logos/prints.
   - BODY PROPORTION LOCK: Height relative to other characters (taller by a head, same height, shorter), body build (slender/slim/athletic/stocky/petite/tall and lean), any notable posture.
   - ACCESSORIES AND BODY ATTACHMENTS LOCK (mandatory — do NOT skip if visible): Any object physically on/attached to the character's body — jewelry (earrings: type+size+material+color, necklaces, rings, bracelets), glasses/sunglasses (frame color+shape), hats/headwear (type+color+material), bags/backpacks (color+style), any decorative body items. For stylized/animated characters: attached organic elements (leaf crown, petals, vines, fruit stems). State the exact attachment point and condition.
   - DIALOGUE SPEAKER LOCK: The character name/role before the colon in voiceOverDarija is the ONLY character who speaks that line. Only that character's mouth moves. All others: mouths fully closed. This is non-negotiable.
   - NEVER swap dialogue between any two characters.
   - SPECIES LOCK: A character's fruit/species type is determined by their FAMILY LINEAGE, not by other characters' names. Explicitly label each character's species in every imagePrompt.

1B. CHARACTER STATE CONTINUITY — TRACK CHANGES ACROSS SCENES
   ⚠️ THIS IS A CRITICAL RULE — BREAKING IT CAUSES DIRECT IMAGE INCONSISTENCY
   - Before writing scenes, mentally track a "STATE LOG" for each character:
     • Starting state: their full appearance at first appearance
     • Each time an event physically changes a character (removes hair/leaves, adds injury, changes outfit, cuts hair, removes an accessory), LOG that change
   - From the scene AFTER the change occurs: ALL imagePrompts must show the POST-CHANGE state
   - NEVER show an attribute that was explicitly removed in a previous scene
   - Examples of mandatory state tracking:
     • "Husband removes Frizita's leaf crown with clippers in Scene 1" → Scene 2, 3, 4... must describe Frizita WITHOUT any leaf crown — write "bare smooth strawberry head, no leaves, freshly clipped top"
     • "Character removes jacket in Scene 2" → Scene 3+ must show character without jacket
     • "Character gets injured in Scene 2" → Scene 3+ shows the wound/bandage
   - In every imagePrompt after a change, explicitly state what was removed/changed: e.g., "NOTE: leaf crown removed — head is now bare and smooth with no leaves"

2. IMAGE PROMPT COMPLETENESS — NO DETAIL SKIPPING ALLOWED
   - Every imagePrompt must be 100% self-contained for an external image generator. Do not reference "the style section", "as described above", or "same as previous scene".
   - MANDATORY CHECKLIST — every imagePrompt MUST explicitly include ALL of these:
     ✓ Vertical 9:16 aspect ratio
     ✓ Visual art style (realistic / 3D animated / 2D flat / painterly / etc.)
     ✓ EVERY character's FULL anchor:
       – Hair: color+length+style (or leaf/plant description for stylized)
       – Face: eye color+shape, nose shape, mouth/lip color+shape, eyebrows, face shape
       – DISTINGUISHING MARKS: scars (location+color+shape), moles, birthmarks, freckles — write "none visible" if absent, never skip
       – Skin tone with undertone
       – Clothing: exact color name+garment+fit+pattern
       – ACCESSORIES: all jewelry, glasses, hats, bags — write "no accessories" if none
       – Height/build relative to others
       – Position in frame
       – CHARACTER STATE: note any changes from previous scenes (e.g., "leaf crown REMOVED — bare head")
     ✓ Exact environment: room type, wall color/texture, floor material, furniture style, lighting source, time of day
     ✓ Camera framing: close-up / medium shot / wide shot
     ✓ Camera angle: eye-level / low angle / high angle / overhead
     ✓ Lighting: direction (front-lit / side-lit / back-lit), quality (soft/hard), color temperature (warm/cool/neutral)
     ✓ Color palette: 3-4 dominant hues, saturation level, contrast
     ✓ Mood and atmosphere (tense, warm, melancholy, joyful, etc.)
     ✓ Key props with exact position
   - For animated/stylized characters: describe head shape (fruit/vegetable type + size), body material (clay / smooth 3D plastic / glossy resin), FULL face design (painted vs 3D raised eyes, eye size, lid style, pupil highlight), scale ratio between characters.
   - ⚠️ MINIMUM 150 words per imagePrompt. Any prompt under 150 words is considered INCOMPLETE. Be surgically precise.
   - ⚠️ ZERO vague sentences allowed: "wearing colorful clothes" = INVALID. "wearing a bright coral-red oversized hoodie with a small white logo on the chest" = VALID.

3. ANIMATION PROMPT COMPLETENESS
   - Every animationPrompt must include: exact subject movement path, facial expression evolution, body gesture sequence, camera movement type+speed+direction, shot duration estimate, transition type into next scene, and emotional arc.
   - SPEAKER BLOCKING SECTION (mandatory when dialogue exists): list each dialogue line with its speaker and describe exactly: who moves their mouth, what their body does while speaking, what the OTHER characters do (silent reaction only — closed mouth, eyes listening, subtle nod/expression), and an explicit warning like "⚠️ ONLY [Speaker Name] speaks this line — all other characters keep mouths fully closed."
   - ⚠️ MINIMUM 120 WORDS per animationPrompt. Under 120 = INCOMPLETE.

4. DIALOGUE ACCURACY
   - Use the audio transcript as primary source. Preserve every distinct speaker turn.
   - voiceOverDarija must be a labeled block, one line per speaker turn, separated by \\n.
   - Format: SpeakerRole: "line in Moroccan Darija"
   - Use precise role labels that match the visual anchor: e.g. "Strawberry Mother", "Banana Father", "Red Daughter", "Husband", "Wife" — not generic "Character 1."
   - Write dialogue in natural Moroccan Darija (Arabic script preferred). Keep proper names in Latin if heard.
   - If transcript has multiple turns in one scene, preserve ALL turns. Do not collapse multi-speaker dialogue into one line.

5. SCENE COUNT AND FLOW
   - Do not force a fixed scene count. Let the visible video content decide.
   - Scene 1 = the visual hook (most scroll-stopping moment).
   - Split scenes when: new location, new character enters, emotional beat shifts, camera cut changes composition significantly.
   - Merge only if the action is fully continuous with no meaningful visual change.

6. SOUND PROMPT COMPLETENESS
   - Include: background ambience description, music genre+tempo+mood, specific sound effect moments (footstep timing, impact hits, whoosh transitions), volume relationship between music and dialogue, and any diegetic sounds from visible actions.

═══════════════════
WHAT TO IGNORE
═══════════════════
- Do not let niche metadata change the video content you describe.
- Do not mention file names or source names.
- Do not invent details not visible or audible in the frames/transcript.
- Do not write generic marketing copy or productivity scenes unrelated to the actual video.

═══════════════════
ADDITIONAL CONTEXT
═══════════════════
- User notes (extra context only, does not override frames): ${input.reelNotes}
- Audio transcript: ${audioTranscript || "No usable speech transcript was extracted. Describe background sound from visual context only and do not claim exact spoken lines."}
${retryNote}

═══════════════════
OUTPUT FORMAT
═══════════════════
Return JSON with exactly these keys:

{
  "title": "short precise title describing the actual visible video content",
  "summaryPrompt": "markdown with two sections: ### Style and ### Cinematography. Style: bullet points for **Visual Texture** (surface quality, rendering style, grain/smoothness), **Lighting Quality** (soft/hard, direction, color temp), **Color Palette** (dominant hues, saturation, contrast level), **Atmosphere** (emotional feel, time of day, environmental mood). Cinematography: bullet points for **Camera** (movement type, speed, axis), **Lens** (focal length feel, depth of field), **Lighting Setup** (key/fill/rim placement), **Mood** (visual emotion, pacing). Every bullet must be a concrete technical description, not a vague generic sentence.",
  "scenes": [
    {
      "title": "precise description of this specific visible beat",
      "imagePrompt": "SELF-CONTAINED copy-ready English image-generation prompt (MIN 150 WORDS — shorter is REJECTED): vertical 9:16, art style, FULL character physical anchor (hair: exact color+length+style, skin tone, eye color, clothing: exact color name+garment+fit, height/build, position), exact environment (room type, wall color, floor material, furniture), camera framing+angle, lighting direction+quality+color temp, color palette (3-4 dominant hues), mood/atmosphere, props with position. ZERO vague sentences.",
      "animationPrompt": "COMPLETE copy-ready English animation prompt (MIN 120 WORDS): exact subject movement path, facial expression evolution, body gestures, camera movement type+speed+direction, shot duration estimate, transition type, emotional arc. For each dialogue line: SPEAKER BLOCKING with explicit ⚠️ warning naming which character's mouth moves and confirming all others keep mouths fully closed.",
      "voiceOverDarija": "speaker-labeled Moroccan Darija dialogue block — one line per speaker turn — e.g. Strawberry Mother: \\"...\\"\nStrawberry Father: \\"...\\"\nStrawberry Mother: \\"...\\"",
      "soundEffectsPrompt": "English sound design brief: ambience, music genre+tempo, specific sfx moments, volume mix, diegetic sounds from visible actions"
    }
  ]
}

The scenes array must contain as many objects as the video content requires. Do not cap it artificially.`,
              },
              ...frames,
            ],
          },
        ],
        max_completion_tokens: 16000,
      }),
    }).finally(() => clearTimeout(timeoutId));
  };

  let response = await sendAnalysisRequest(frameInputs);

  if (!response.ok) {
    const errorText = await response.text();
    if (isImageProcessingServerError(errorText) && input.videoFrames.length > 8) {
      const retryFrames = buildFrameInputs(input.videoFrames, 12, "low");
      response = await sendAnalysisRequest(
        retryFrames,
        "\n- This is a retry with fewer sampled frames because the first image processing attempt failed internally. Use these fewer frames plus the transcript to preserve the same beginning-to-end story flow as much as possible.",
      );

      if (response.ok) {
        return normalizeVideoAnalysisResponse(await response.json(), baseUrl, apiKey, input);
      }

      const retryErrorText = await response.text();
      throw new Error(`AI video analysis failed after retry: ${retryErrorText.slice(0, 500)}`);
    }

    throw new Error(`AI video analysis failed: ${errorText.slice(0, 500)}`);
  }

  return normalizeVideoAnalysisResponse(await response.json(), baseUrl, apiKey, input);
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

  const parsed = (await parseOrRepairJsonObject(content, baseUrl, apiKey)) as {
    title?: string;
    summaryPrompt?: string;
    scenes?: Array<Partial<GeneratedScene>>;
  };

  if (!Array.isArray(parsed.scenes) || parsed.scenes.length < 1) {
    throw new Error("AI video analysis did not return any scenes.");
  }

  return {
    title: truncateGeneratedText(parsed.title || `${input.niche.name}: analyzed reel prompt pack`, 120),
    summaryPrompt: truncateGeneratedText(
      parsed.summaryPrompt ||
        `### Style\n* **Visual Texture:** AI analyzed the uploaded video frames and generated a direct recreation brief from the visible content.\n* **Lighting Quality:** Match the lighting visible in the source frames.\n* **Color Palette:** Match the colors visible in the source frames.\n* **Atmosphere:** Preserve the source video's mood.\n\n### Cinematography\n* **Camera:** Match the source framing and camera movement.\n* **Lens:** Match the source perspective.\n* **Lighting:** Match the source lighting direction and intensity.\n* **Mood:** Preserve the source visual emotion.`,
      5000,
    ),
    scenes: parsed.scenes.map((scene, index) => {
      const title = truncateGeneratedText(scene.title || (index === 0 ? "Hook from analyzed reel" : `Scene ${index + 1}`), 160);
      const frames = input.videoFrames ?? [];

      return {
        sceneNumber: index + 1,
        sceneType: index === 0 ? "hook" : "scene",
        title,
        imagePrompt: requireGeneratedText(
          scene.imagePrompt,
          "image prompt",
          `Vertical 9:16 image-generation prompt. Recreate this visible beat from the analyzed video: ${title}. Include the exact subject, character design, setting, composition, camera framing, lighting, color palette, props, action, and mood visible in the sampled frames.`,
        ),
        animationPrompt: requireGeneratedText(
          scene.animationPrompt,
          "animation prompt",
          `Animate this beat with camera movement and character action that matches the uploaded video moment: ${title}. If there is dialogue, only the named speaker should move their mouth for each line while the other characters react silently; do not swap speaker roles.`,
        ),
        voiceOverDarija: normalizeDialogueBlock(scene.voiceOverDarija, "No clear dialogue heard in this scene."),
        soundEffectsPrompt: requireGeneratedText(
          scene.soundEffectsPrompt,
          "sound prompt",
          "Use background sound and music that match the audible mood of this moment without inventing unrelated effects.",
        ),
        sceneFrameUrl: pickFrameForScene(frames, index, parsed.scenes.length),
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

async function transcribeVideoAudio(videoDataUrl: string, baseUrl: string, apiKey: string) {
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
      return "No usable audio track was detected in the uploaded video.";
    }

    const audioBuffer = await readFile(audioPath);
    if (audioBuffer.byteLength < 1024) {
      return "No usable audio track was detected in the uploaded video.";
    }

    const formData = new FormData();
    formData.append("model", "gpt-4o-mini-transcribe");
    formData.append("file", new Blob([audioBuffer], { type: "audio/wav" }), "audio.wav");
    formData.append("response_format", "json");

    const transcribeController = new AbortController();
    const transcribeTimeout = setTimeout(() => transcribeController.abort(), 60 * 1000); // 60s max
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/audio/transcriptions`, {
      method: "POST",
      signal: transcribeController.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    }).finally(() => clearTimeout(transcribeTimeout));

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Audio transcription failed: ${errorText.slice(0, 500)}`);
    }

    const payload = (await response.json()) as { text?: string };
    return payload.text?.trim() || "The audio track was present, but no clear speech was transcribed.";
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
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
