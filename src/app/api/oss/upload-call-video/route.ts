import { logger } from "@/lib/logger";
import { getCallVideoObjectKey, getPresignedPutUrl } from "@/lib/oss";
import { NextResponse } from "next/server";

/**
 * 给浏览器签发一个临时（5分钟）OSS 预签名 PUT URL，
 * 用于直传 MediaRecorder 录制的面试视频（VP9 WebM）。
 *
 * 流程：
 *   1. 前端 POST 这里，body 带 call_id + content_type
 *   2. 这里返回 { uploadUrl, publicUrl }
 *   3. 前端用 uploadUrl 直接 PUT blob 到 OSS（不绕 Next.js）
 *   4. 上传成功后前端把 publicUrl 写到 response.video_url
 *
 * 安全：候选人面试页 /call/[id] 公开访问，候选人无登录态 → 不能要求 session。
 * 用以下边界控制防滥用：
 *   - call_id 是 nanoid 21 字符随机串，不可枚举
 *   - objectKey 锁死 call-videos/{callId}/ 前缀（getCallVideoObjectKey 内部强制）
 *   - content_type 白名单 video/webm | video/mp4
 *   - 预签名 URL 5 分钟有效，PUT 完即过期
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const callId = String(body.call_id ?? "").trim();
    const contentType = String(body.content_type ?? "video/webm").trim();

    // call_id 必须是 nanoid 格式：仅 url-safe base64 字符
    if (!callId || !/^[A-Za-z0-9_-]{1,64}$/.test(callId)) {
      return NextResponse.json({ error: "invalid call_id" }, { status: 400 });
    }
    // content_type 白名单，防止用 "../" 之类的内容污染头
    if (!/^video\/(webm|mp4)(;.*)?$/.test(contentType)) {
      return NextResponse.json({ error: "invalid content_type" }, { status: 400 });
    }

    // 文件后缀按 contentType 决定，浏览器才能按 URL 嗅探到正确 mime
    const ext = contentType.startsWith("video/mp4") ? "mp4" : "webm";
    const objectKey = getCallVideoObjectKey(callId, ext);
    const { uploadUrl, publicUrl } = getPresignedPutUrl(objectKey, contentType);

    logger.info(`[upload-call-video] signed url for call=${callId} key=${objectKey}`);
    return NextResponse.json({ uploadUrl, publicUrl, objectKey }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[upload-call-video] sign failed: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
