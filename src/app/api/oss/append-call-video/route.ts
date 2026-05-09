import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { appendToOSS, getCallVideoObjectKey, getOSSPublicUrl } from "@/lib/oss";
import { NextRequest, NextResponse } from "next/server";

/**
 * 边录边传：把 MediaRecorder 的一个 chunk append 到 OSS 同一个对象。
 *
 * 调用约定（前端）：
 *   POST /api/oss/append-call-video?call_id=xxx&position=N&first=1
 *   Headers: Content-Type: application/octet-stream
 *   Body: 原始 chunk 二进制（可直接传 ArrayBuffer / Blob）
 *
 * - first=1 表示这是首片，后端会用 call_id 生成新 objectKey 并返回；
 *   后续片不传 first，但要带 object_key=（首片返回的）+ position（上次 nextAppendPosition）
 * - 返回：{ nextAppendPosition, objectKey, publicUrl }
 *
 * 安全：必须登录；call_id / position 严校验防 path traversal、防伪造他人 key。
 *
 * MediaRecorder 的 webm 切片是按设计可顺序拼接的（首片含 EBML header，
 * 后续是 cluster 续段），所以 OSS append 出来的最终对象就是一个合法可播放 WebM。
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const url = req.nextUrl;
    const callId = (url.searchParams.get("call_id") ?? "").trim();
    const positionStr = url.searchParams.get("position") ?? "0";
    const isFirst = url.searchParams.get("first") === "1";
    const objectKeyParam = (url.searchParams.get("object_key") ?? "").trim();

    if (!callId || !/^[A-Za-z0-9_-]{1,64}$/.test(callId)) {
      return NextResponse.json({ error: "invalid call_id" }, { status: 400 });
    }
    const position = Number(positionStr);
    if (!Number.isFinite(position) || position < 0) {
      return NextResponse.json({ error: "invalid position" }, { status: 400 });
    }

    // 首片：服务端生成 objectKey 并把控其唯一性（防客户端伪造他人 key）
    // 后续片：必须带回首片返回的 objectKey，且必须以 call-videos/{callId}/ 开头
    let objectKey: string;
    if (isFirst) {
      objectKey = getCallVideoObjectKey(callId);
    } else {
      objectKey = objectKeyParam;
      const expectedPrefix = `call-videos/${callId}/`;
      if (!objectKey.startsWith(expectedPrefix)) {
        return NextResponse.json({ error: "invalid object_key" }, { status: 400 });
      }
    }

    // body 取原始 buffer。Edge runtime + Node runtime 都支持 arrayBuffer。
    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: "empty chunk" }, { status: 400 });
    }
    const buffer = Buffer.from(arrayBuffer);

    const result = await appendToOSS(objectKey, buffer, position);

    return NextResponse.json(
      {
        nextAppendPosition: result.nextAppendPosition,
        objectKey,
        publicUrl: getOSSPublicUrl(objectKey),
      },
      { status: 200 },
    );
  } catch (err: any) {
    // OSS 在 position 不匹配时会抛 PositionNotEqualToLength —— 把详情透传给前端方便调试
    const code = err?.code ?? err?.name ?? "unknown";
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[append-call-video] failed code=${code} msg=${msg}`);
    return NextResponse.json({ error: msg, code }, { status: 500 });
  }
}

// 大请求 body 不要 buffer 多次：5s chunk 通常 100-200KB，给 1MB 上限够用且安全。
export const runtime = "nodejs";
