import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);

export type EnrichedFrame = {
  frameIndex: number;
  timestamp: number;
  isSceneChange: boolean;
  base64: string;
};

export type SceneChange = {
  timestamp: number;
  type: "hard_cut" | "soft_transition";
  confidence: number;
};

export type SceneDetectionResult = {
  sceneChanges: SceneChange[];
  sceneTimestamps: number[];
  totalScenes: number;
  averageSceneDuration: number;
  detectionThresholdUsed: number;
  durationSeconds: number;
};

/**
 * Run FFmpeg scene detection at a specific threshold.
 * Returns raw timestamps and their scene scores.
 */
async function detectSceneChangesRaw(
  videoPath: string,
  threshold: number,
): Promise<{ timestamp: number; score: number }[]> {
  try {
    const { stderr } = await execFileAsync(
      "ffmpeg",
      [
        "-i", videoPath,
        "-vf", `select='gt(scene,${threshold})',metadata=print:file=-`,
        "-vsync", "vfr",
        "-f", "null",
        "-",
      ],
      { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
    );

    const results: { timestamp: number; score: number }[] = [];
    const ptsTimeRegex = /pts_time:([\d.]+)/g;
    const scoreRegex = /lavfi\.scene_score=([\d.]+)/g;

    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = ptsTimeRegex.exec(stderr)) !== null) {
      const ts = parseFloat(match[1]);
      if (Number.isFinite(ts)) timestamps.push(ts);
    }

    const scores: number[] = [];
    while ((match = scoreRegex.exec(stderr)) !== null) {
      const s = parseFloat(match[1]);
      if (Number.isFinite(s)) scores.push(s);
    }

    for (let i = 0; i < timestamps.length; i++) {
      results.push({ timestamp: timestamps[i], score: scores[i] ?? threshold });
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Adaptive dual-pass scene detection:
 * Pass 1: high threshold (0.4) for hard cuts
 * Pass 2: low threshold (0.2) for soft transitions
 * Merge, deduplicate, and validate scene count.
 */
async function detectSceneChangesAdaptive(
  videoPath: string,
  durationSeconds: number,
): Promise<{ changes: SceneChange[]; thresholdUsed: number }> {
  // Pass 1: Hard cuts (high confidence)
  const hardCuts = await detectSceneChangesRaw(videoPath, 0.4);

  // Pass 2: Soft transitions (lower confidence)
  const softTransitions = await detectSceneChangesRaw(videoPath, 0.2);

  // Merge: hard cuts take priority, add soft transitions that aren't near hard cuts
  const allChanges: SceneChange[] = [];

  for (const hc of hardCuts) {
    allChanges.push({ timestamp: hc.timestamp, type: "hard_cut", confidence: Math.min(hc.score, 1.0) });
  }

  for (const st of softTransitions) {
    const tooClose = allChanges.some((c) => Math.abs(c.timestamp - st.timestamp) < 0.3);
    if (!tooClose) {
      allChanges.push({ timestamp: st.timestamp, type: "soft_transition", confidence: Math.min(st.score, 1.0) });
    }
  }

  // Sort by timestamp
  allChanges.sort((a, b) => a.timestamp - b.timestamp);

  // Remove scene changes within 0.3s of each other (keep higher confidence)
  const deduped: SceneChange[] = [];
  for (const change of allChanges) {
    const prev = deduped[deduped.length - 1];
    if (prev && change.timestamp - prev.timestamp < 0.3) {
      if (change.confidence > prev.confidence) {
        deduped[deduped.length - 1] = change;
      }
    } else {
      deduped.push(change);
    }
  }

  // Scene count validation
  const minExpected = Math.floor(durationSeconds / 5);
  const maxExpected = Math.floor(durationSeconds * 3);
  let thresholdUsed = 0.2;

  if (deduped.length < minExpected && durationSeconds > 3) {
    // Too few scenes — try ultra-low threshold
    const ultraLow = await detectSceneChangesRaw(videoPath, 0.15);
    for (const ul of ultraLow) {
      const tooClose = deduped.some((c) => Math.abs(c.timestamp - ul.timestamp) < 0.3);
      if (!tooClose) {
        deduped.push({ timestamp: ul.timestamp, type: "soft_transition", confidence: Math.min(ul.score, 1.0) });
      }
    }
    deduped.sort((a, b) => a.timestamp - b.timestamp);
    thresholdUsed = 0.15;
  } else if (deduped.length > maxExpected) {
    // Too many scenes — keep only high-confidence ones
    const filtered = deduped.filter((c) => c.confidence >= 0.4 || c.type === "hard_cut");
    if (filtered.length >= minExpected) {
      return { changes: filtered, thresholdUsed: 0.4 };
    }
    thresholdUsed = 0.4;
  }

  return { changes: deduped, thresholdUsed };
}

/**
 * Extract frames from a video at specific timestamps using FFmpeg.
 * Returns base64-encoded JPEG frames at 640px width, quality 85.
 */
async function extractFramesAtTimestamps(
  videoPath: string,
  timestamps: number[],
  workDir: string,
): Promise<Map<number, string>> {
  if (timestamps.length === 0) return new Map();

  const framesDir = path.join(workDir, "frames");
  await mkdir(framesDir, { recursive: true });

  const frameMap = new Map<number, string>();

  // Extract all frames in one FFmpeg call using select filter
  const selectExpr = timestamps.map((t) => `eq(n\\,0)+gte(t\\,${t.toFixed(3)})*lte(t\\,${(t + 0.05).toFixed(3)})`).join("+");

  // For efficiency, extract all at once using fps filter + scene timestamps
  // Use individual seeks for precision
  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    const outFile = path.join(framesDir, `frame_${String(i).padStart(4, "0")}.jpg`);
    try {
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-ss", ts.toFixed(3),
          "-i", videoPath,
          "-vf", "scale=640:-2",
          "-vframes", "1",
          "-q:v", "2",
          "-f", "image2",
          outFile,
        ],
        { timeout: 10_000 },
      );
      const buf = await readFile(outFile);
      frameMap.set(ts, `data:image/jpeg;base64,${buf.toString("base64")}`);
    } catch {
      // Skip frames that fail to extract
    }
  }

  return frameMap;
}

/**
 * Get video duration in seconds using ffprobe.
 */
async function getVideoDuration(videoPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      videoPath,
    ]);
    const probe = JSON.parse(stdout) as { format?: { duration?: string } };
    return parseFloat(probe.format?.duration ?? "0") || 30;
  } catch {
    return 30;
  }
}

/**
 * Generate fixed-interval timestamps at 1 frame per second.
 */
function generateIntervalTimestamps(durationSeconds: number): number[] {
  const timestamps: number[] = [];
  for (let t = 0; t < durationSeconds; t += 1) {
    timestamps.push(t);
  }
  return timestamps;
}

/**
 * Merge scene-change and interval timestamps, removing duplicates
 * within 0.5s proximity. Scene-change frames take priority.
 */
function mergeAndDedup(
  sceneTimestamps: number[],
  intervalTimestamps: number[],
  proximityThreshold = 0.5,
): { timestamp: number; isSceneChange: boolean }[] {
  const sceneSet = new Set(sceneTimestamps.map((t) => Math.round(t * 1000)));

  const merged: { timestamp: number; isSceneChange: boolean }[] = [];

  // Add all scene-change timestamps first (they are mandatory)
  for (const ts of sceneTimestamps) {
    merged.push({ timestamp: ts, isSceneChange: true });
  }

  // Add interval timestamps that aren't too close to scene-change timestamps
  for (const ts of intervalTimestamps) {
    const tooClose = sceneTimestamps.some(
      (st) => Math.abs(st - ts) < proximityThreshold,
    );
    if (!tooClose) {
      merged.push({ timestamp: ts, isSceneChange: false });
    }
  }

  // Sort by timestamp
  merged.sort((a, b) => a.timestamp - b.timestamp);

  return merged;
}

/**
 * Select the best frames to send to AI:
 * - All scene-change frames (mandatory)
 * - Fill gaps with interval frames (no gap > 2s without a frame)
 * - Target: 30-50 frames total (capped for cost)
 */
function selectBestFrames(
  allFrames: { timestamp: number; isSceneChange: boolean }[],
  targetMin = 30,
  targetMax = 50,
): { timestamp: number; isSceneChange: boolean }[] {
  if (allFrames.length <= targetMax) return allFrames;

  // Always keep scene-change frames
  const sceneFrames = allFrames.filter((f) => f.isSceneChange);
  const intervalFrames = allFrames.filter((f) => !f.isSceneChange);

  if (sceneFrames.length >= targetMax) {
    // Too many scene changes — select evenly spaced subset
    return selectEvenlySpaced(sceneFrames, targetMax);
  }

  const remaining = targetMax - sceneFrames.length;
  const selectedInterval = selectEvenlySpaced(intervalFrames, remaining);

  const result = [...sceneFrames, ...selectedInterval];
  result.sort((a, b) => a.timestamp - b.timestamp);

  // Ensure no gap > 2s by filling in additional frames if needed
  return ensureMaxGap(result, allFrames, 2.0);
}

function selectEvenlySpaced<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  return Array.from({ length: count }, (_, i) => {
    const idx = Math.round((i / Math.max(count - 1, 1)) * (items.length - 1));
    return items[idx];
  });
}

function ensureMaxGap(
  selected: { timestamp: number; isSceneChange: boolean }[],
  all: { timestamp: number; isSceneChange: boolean }[],
  maxGap: number,
): { timestamp: number; isSceneChange: boolean }[] {
  const result = [...selected];
  const selectedSet = new Set(result.map((f) => f.timestamp));

  for (let i = 0; i < result.length - 1; i++) {
    const gap = result[i + 1].timestamp - result[i].timestamp;
    if (gap > maxGap) {
      // Find a frame from `all` that fills this gap
      const midpoint = (result[i].timestamp + result[i + 1].timestamp) / 2;
      const filler = all.find(
        (f) => !selectedSet.has(f.timestamp) && Math.abs(f.timestamp - midpoint) < gap / 2,
      );
      if (filler) {
        result.push(filler);
        selectedSet.add(filler.timestamp);
      }
    }
  }

  result.sort((a, b) => a.timestamp - b.timestamp);
  return result;
}

/**
 * Write a base64 data URL video to a temp file for FFmpeg processing.
 * Returns the file path and a cleanup function.
 */
async function writeVideoToTemp(videoDataUrl: string): Promise<{ videoPath: string; workDir: string; cleanup: () => Promise<void> }> {
  const workDir = path.join(tmpdir(), `scene-detect-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });

  const base64Match = videoDataUrl.match(/^data:video\/\w+;base64,(.+)$/);
  if (!base64Match) throw new Error("Invalid video data URL format");

  const videoPath = path.join(workDir, "input.mp4");
  await writeFile(videoPath, Buffer.from(base64Match[1], "base64"));

  return {
    videoPath,
    workDir,
    cleanup: async () => { await rm(workDir, { recursive: true, force: true }); },
  };
}

/**
 * Main entry point: extract enriched frames from a video data URL.
 * Combines FFmpeg scene detection with fixed-interval extraction.
 */
export async function extractEnrichedFrames(videoDataUrl: string): Promise<{
  frames: EnrichedFrame[];
  durationSeconds: number;
  sceneChangeCount: number;
}> {
  const { videoPath, workDir, cleanup } = await writeVideoToTemp(videoDataUrl);

  try {
    const durationSeconds = await getVideoDuration(videoPath);

    // Run adaptive scene detection and generate interval timestamps in parallel
    const [adaptiveResult, intervalTimestamps] = await Promise.all([
      detectSceneChangesAdaptive(videoPath, durationSeconds),
      Promise.resolve(generateIntervalTimestamps(durationSeconds)),
    ]);

    const sceneTimestamps = adaptiveResult.changes.map((c) => c.timestamp);

    // Merge and deduplicate
    const mergedTimestamps = mergeAndDedup(sceneTimestamps, intervalTimestamps);

    // Select best frames for AI
    const selectedFrames = selectBestFrames(mergedTimestamps);

    // Extract actual frame images at selected timestamps
    const allTimestamps = selectedFrames.map((f) => f.timestamp);
    const frameImages = await extractFramesAtTimestamps(videoPath, allTimestamps, workDir);

    // Build enriched frames array
    const enrichedFrames: EnrichedFrame[] = [];
    let frameIndex = 0;
    for (const frame of selectedFrames) {
      const base64 = frameImages.get(frame.timestamp);
      if (base64) {
        enrichedFrames.push({
          frameIndex: frameIndex++,
          timestamp: Math.round(frame.timestamp * 1000) / 1000,
          isSceneChange: frame.isSceneChange,
          base64,
        });
      }
    }

    return {
      frames: enrichedFrames,
      durationSeconds,
      sceneChangeCount: sceneTimestamps.length,
    };
  } finally {
    await cleanup();
  }
}

/**
 * Full scene detection with adaptive thresholds, returning rich metadata.
 */
export async function detectScenesFromVideo(videoDataUrl: string): Promise<SceneDetectionResult> {
  const { videoPath, workDir, cleanup } = await writeVideoToTemp(videoDataUrl);

  try {
    const durationSeconds = await getVideoDuration(videoPath);
    const adaptiveResult = await detectSceneChangesAdaptive(videoPath, durationSeconds);

    const sceneTimestamps = adaptiveResult.changes.map((c) => c.timestamp);
    const totalScenes = sceneTimestamps.length + 1; // scenes = cuts + 1
    const avgDuration = totalScenes > 0 ? durationSeconds / totalScenes : durationSeconds;

    return {
      sceneChanges: adaptiveResult.changes,
      sceneTimestamps,
      totalScenes,
      averageSceneDuration: Math.round(avgDuration * 100) / 100,
      detectionThresholdUsed: adaptiveResult.thresholdUsed,
      durationSeconds,
    };
  } finally {
    await cleanup();
  }
}
