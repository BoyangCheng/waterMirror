import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * POST /api/voice-preview
 * Body: { voice_type: string }
 * Returns: audio/mpeg binary (Volcengine TTS, standard non-streaming)
 */
export async function POST(req: Request) {
  const { voice_type } = await req.json();

  const appId = process.env.VOLCENGINE_TTS_APP_ID ?? "";
  const token = process.env.VOLCENGINE_TTS_ACCESS_TOKEN ?? "";

  if (!appId || !token) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 500 });
  }

  const previewText = "你好，我是你今天的面试官，请先介绍一下你的过往经历。";
  const reqId = crypto.randomUUID();

  const ttsBody = {
    app: { appid: appId, token, cluster: "volcano_tts" },
    user: { uid: "preview" },
    audio: {
      voice_type: voice_type ?? "BV701_streaming",
      encoding: "mp3",
      speed_ratio: 1.0,
    },
    request: {
      reqid: reqId,
      text: previewText,
      operation: "query",
    },
  };

  const res = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer;${token}`,
    },
    body: JSON.stringify(ttsBody),
  });

  const json = await res.json();
  if (json?.code !== 3000 || !json?.data) {
    console.error("[VoicePreview] TTS error:", JSON.stringify(json));
    return NextResponse.json(
      { error: `TTS failed: ${json?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  // Volcengine returns base64-encoded MP3
  const audioBuffer = Buffer.from(json.data, "base64");
  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBuffer.byteLength),
    },
  });
}
