import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);

export type DownloadedVideo = {
  videoPath: string;
  audioPath: string;
  frames: string[];
  durationSeconds: number;
  cleanup: () => Promise<void>;
};

function detectPlatform(url: string): "youtube" | "tiktok" | "instagram" | "unknown" {
  if (/youtu\.be|youtube\.com/i.test(url)) return "youtube";
  if (/tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  return "unknown";
}

async function downloadYouTube(url: string, outputPath: string): Promise<void> {
  const ytdl = await import("@distube/ytdl-core");
  const info = await ytdl.default.getInfo(url);
  const formats = ytdl.default.filterFormats(info.formats, "videoandaudio");
  const format = formats.find((f) => f.container === "mp4") ?? formats[0];
  if (!format) throw new Error("No downloadable format found for this YouTube video.");

  return new Promise((resolve, reject) => {
    const stream = ytdl.default(url, { format });
    const writer = createWriteStream(outputPath);
    stream.pipe(writer);
    stream.on("error", reject);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function downloadTikTok(url: string, outputPath: string): Promise<void> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G975U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://www.tiktok.com/",
  };

  const pageRes = await fetch(url, { headers });
  if (!pageRes.ok) throw new Error(`TikTok page request failed: ${pageRes.status}`);
  const html = await pageRes.text();

  const match =
    html.match(/"playAddr":"(https:[^"]+\.mp4[^"]*)"/) ??
    html.match(/"downloadAddr":"(https:[^"]+\.mp4[^"]*)"/) ??
    html.match(/https:\/\/v\d+-webapp\.tiktok\.com[^"'\\]+\.mp4[^"'\\]*/);

  if (!match) throw new Error("Could not extract TikTok video URL from page. The video may be private or unavailable.");

  const videoUrl = match[1] ?? match[0];
  const decodedUrl = videoUrl.replace(/\\u002F/g, "/");

  const videoRes = await fetch(decodedUrl, {
    headers: {
      ...headers,
      "Range": "bytes=0-",
    },
  });
  if (!videoRes.ok) throw new Error(`TikTok video download failed: ${videoRes.status}`);

  const buffer = await videoRes.arrayBuffer();
  const { writeFile } = await import("node:fs/promises");
  await writeFile(outputPath, Buffer.from(buffer));
}

async function downloadInstagram(url: string, outputPath: string): Promise<void> {
  const headers = {
    "User-Agent": "Instagram 76.0.0.15.395 Android",
    "Accept": "*/*",
  };

  const apiUrl = url.replace(/\/$/, "") + "?__a=1&__d=dis";
  const res = await fetch(apiUrl, { headers });
  const data = await res.json().catch(() => null) as Record<string, unknown> | null;

  let videoUrl: string | undefined;
  const graphql = data?.graphql as Record<string, unknown> | undefined;
  const shortcodeMedia = graphql?.shortcode_media as Record<string, unknown> | undefined;
  const videoUrlFromMedia = shortcodeMedia?.video_url;
  if (typeof videoUrlFromMedia === "string") {
    videoUrl = videoUrlFromMedia;
  }

  if (!videoUrl) throw new Error("Could not extract Instagram video URL. Private content or unsupported format.");

  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error(`Instagram video download failed: ${videoRes.status}`);
  const buffer = await videoRes.arrayBuffer();
  const { writeFile } = await import("node:fs/promises");
  await writeFile(outputPath, Buffer.from(buffer));
}

function optimalFrameCount(durationSeconds: number): number {
  if (durationSeconds <= 15) return 30;
  if (durationSeconds <= 30) return 45;
  if (durationSeconds <= 60) return 60;
  return 90;
}

async function extractFramesFromFile(
  videoPath: string,
  workDir: string,
  maxFramesOverride?: number,
): Promise<{ frames: string[]; durationSeconds: number }> {
  const probeResult = await execFileAsync("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    videoPath,
  ]).catch(() => ({ stdout: "{}" }));

  const probe = JSON.parse(probeResult.stdout) as { format?: { duration?: string } };
  const durationSeconds = parseFloat(probe.format?.duration ?? "0") || 30;

  const maxFrames = maxFramesOverride ?? optimalFrameCount(durationSeconds);
  const frameInterval = Math.max(1, Math.floor(durationSeconds / maxFrames));
  const framesDir = path.join(workDir, "frames");
  await mkdir(framesDir, { recursive: true });

  await execFileAsync("ffmpeg", [
    "-y", "-i", videoPath,
    "-vf", `fps=1/${frameInterval},scale=1080:-2`,
    "-vframes", String(maxFrames),
    "-q:v", "3",
    path.join(framesDir, "frame_%04d.jpg"),
  ], { timeout: 120_000 });

  const { readdir } = await import("node:fs/promises");
  const frameFiles = (await readdir(framesDir)).filter((f) => f.endsWith(".jpg")).sort();
  const frames: string[] = [];
  for (const file of frameFiles.slice(0, maxFrames)) {
    const buf = await readFile(path.join(framesDir, file));
    frames.push(`data:image/jpeg;base64,${buf.toString("base64")}`);
  }

  return { frames, durationSeconds };
}

async function extractAudioFromFile(videoPath: string, workDir: string): Promise<string> {
  const audioPath = path.join(workDir, "audio.mp3");
  await execFileAsync("ffmpeg", [
    "-y", "-i", videoPath,
    "-vn", "-ac", "1", "-ar", "16000", "-t", "600",
    audioPath,
  ], { timeout: 60_000 });
  return audioPath;
}

export async function downloadAndExtractVideo(url: string): Promise<DownloadedVideo> {
  const workDir = path.join(tmpdir(), `reel-dl-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });
  const videoPath = path.join(workDir, "video.mp4");

  const cleanup = async () => {
    await rm(workDir, { recursive: true, force: true });
  };

  const platform = detectPlatform(url);

  try {
    if (platform === "youtube") {
      await downloadYouTube(url, videoPath);
    } else if (platform === "tiktok") {
      await downloadTikTok(url, videoPath);
    } else if (platform === "instagram") {
      await downloadInstagram(url, videoPath);
    } else {
      const res = await fetch(url);
      if (!res.ok || !res.headers.get("content-type")?.includes("video")) {
        throw new Error("URL is not a direct video link. Supported platforms: TikTok, YouTube, Instagram.");
      }
      const buf = await res.arrayBuffer();
      const { writeFile } = await import("node:fs/promises");
      await writeFile(videoPath, Buffer.from(buf));
    }

    const fileStat = await stat(videoPath);
    if (fileStat.size === 0) throw new Error("Downloaded file is empty.");

    const [{ frames, durationSeconds }, audioPath] = await Promise.all([
      extractFramesFromFile(videoPath, workDir),
      extractAudioFromFile(videoPath, workDir).catch(() => ""),
    ]);

    if (frames.length === 0) throw new Error("Could not extract frames from the downloaded video.");

    return { videoPath, audioPath, frames, durationSeconds, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

export async function videoFileToDataUrl(videoPath: string): Promise<string> {
  const buf = await readFile(videoPath);
  return `data:video/mp4;base64,${buf.toString("base64")}`;
}
