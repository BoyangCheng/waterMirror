import crypto from "crypto";

// ---------------------------------------------------------------------------
// RTC Token Generation
// Ref: https://www.volcengine.com/docs/6348/70121
//      https://github.com/volcengine/VolcEngineRTC (Go / Python 参考实现)
//
// 二进制格式 (Big-Endian):
//   "001"                              ← 版本号 (3 ASCII 字节)
//   uint16(contentLen) + contentBytes  ← 带长度前缀的内容
//   uint16(sigLen)     + sigBytes      ← 带长度前缀的 HMAC-SHA256 签名
//
// contentBytes =
//   packString(appId) + packString(roomId) + packString(userId)
//   + uint32(issuedAt) + uint32(expireAt) + uint32(nonce)
//   + packMap(privileges)
//
// 最终输出: Base64 编码
// ---------------------------------------------------------------------------

// Privilege 常量
const PrivPublishStream   = 0;
const PrivSubscribeStream = 2;

export function generateRTCToken(
  appId: string,
  appKey: string,
  roomId: string,
  userId: string,
  ttlSeconds = 3600,
): string {
  const now = Math.floor(Date.now() / 1000);
  const expireAt = now + ttlSeconds;
  const nonce = crypto.randomInt(0, 0xffffffff);

  // 权限：发布 + 订阅，与 token 同时过期
  const privileges = new Map<number, number>([
    [PrivPublishStream, expireAt],
    [PrivSubscribeStream, expireAt],
  ]);

  // ---- 构建 content (二进制) ----
  const parts: Buffer[] = [];

  const packString = (s: string) => {
    const strBuf = Buffer.from(s, "utf8");
    const lenBuf = Buffer.alloc(2);
    lenBuf.writeUInt16BE(strBuf.length);
    parts.push(lenBuf, strBuf);
  };

  const packUint32 = (v: number) => {
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(v >>> 0);
    parts.push(buf);
  };

  packString(appId);
  packString(roomId);
  packString(userId);
  packUint32(now);       // issuedAt
  packUint32(expireAt);  // expireAt
  packUint32(nonce);

  // packMap: uint16(count) + foreach(uint16(key) + uint32(value))
  const mapCountBuf = Buffer.alloc(2);
  mapCountBuf.writeUInt16BE(privileges.size);
  parts.push(mapCountBuf);
  for (const [k, v] of privileges) {
    const kBuf = Buffer.alloc(2);
    kBuf.writeUInt16BE(k);
    const vBuf = Buffer.alloc(4);
    vBuf.writeUInt32BE(v >>> 0);
    parts.push(kBuf, vBuf);
  }

  const content = Buffer.concat(parts);

  // ---- 签名 ----
  const sig = crypto.createHmac("sha256", appKey).update(content).digest();

  // ---- 组装最终 token ----
  const packBytes = (buf: Buffer): Buffer => {
    const lenBuf = Buffer.alloc(2);
    lenBuf.writeUInt16BE(buf.length);
    return Buffer.concat([lenBuf, buf]);
  };

  const output = Buffer.concat([
    packBytes(Buffer.from("001", "utf8")),  // 版本 (uint16BE 长度前缀 + "001")
    packBytes(content),                      // 带长度前缀的内容
    packBytes(sig),                          // 带长度前缀的签名
  ]);

  return output.toString("base64");
}

// ---------------------------------------------------------------------------
// Volcengine OpenAPI Signing (HMAC-SHA256, AWS SigV4 style)
// Docs: https://www.volcengine.com/docs/6369/65067
// ---------------------------------------------------------------------------

async function callRTCAPI(action: string, version: string, body: Record<string, unknown>) {
  const accessKeyId = process.env.VOLCENGINE_ACCESS_KEY_ID ?? "";
  const secretKey = process.env.VOLCENGINE_SECRET_KEY ?? "";
  const host = "rtc.volcengineapi.com";
  const region = "cn-north-1";
  const service = "rtc";

  const now = new Date();
  // Format: 20060102T150405Z
  const xDate =
    now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const shortDate = xDate.slice(0, 8);

  const bodyStr = JSON.stringify(body);
  const bodyHash = crypto.createHash("sha256").update(bodyStr).digest("hex");

  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-date:${xDate}\n`;
  const signedHeaders = "content-type;host;x-date";
  const queryString = `Action=${action}&Version=${version}`;

  const canonicalRequest = [
    "POST",
    "/",
    queryString,
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");

  const credentialScope = `${shortDate}/${region}/${service}/request`;
  const stringToSign = [
    "HMAC-SHA256",
    xDate,
    credentialScope,
    crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  const kDate = crypto.createHmac("sha256", secretKey).update(shortDate).digest();
  const kRegion = crypto.createHmac("sha256", kDate).update(region).digest();
  const kService = crypto.createHmac("sha256", kRegion).update(service).digest();
  const kSigning = crypto.createHmac("sha256", kService).update("request").digest();
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  const authorization = `HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${host}?Action=${action}&Version=${version}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Host: host,
      "X-Date": xDate,
      Authorization: authorization,
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Volcengine RTC API error [${action}]: ${res.status} ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// StartVoiceChat
// ---------------------------------------------------------------------------

export interface StartVoiceChatParams {
  roomId: string;
  taskId: string;
  agentUserId: string;
  targetUserId: string;
  systemPrompt: string;
  language: "zh" | "en";
  welcomeMessage?: string;
  voiceType?: string; // Volcengine TTS voice type
}

export async function startVoiceChat(params: StartVoiceChatParams) {
  const appId = process.env.VOLCENGINE_RTC_APP_ID ?? "";
  const asrAppId = process.env.VOLCENGINE_ASR_APP_ID ?? "";
  const asrToken = process.env.VOLCENGINE_ASR_ACCESS_TOKEN ?? "";
  const ttsAppId = process.env.VOLCENGINE_TTS_APP_ID ?? "";
  const ttsToken = process.env.VOLCENGINE_TTS_ACCESS_TOKEN ?? "";
  const dashscopeKey = process.env.DASHSCOPE_API_KEY ?? "";
  const aiModel = process.env.AI_MODEL_SMART ?? "qwen-plus";

  const missing = [
    !appId && "VOLCENGINE_RTC_APP_ID",
    !process.env.VOLCENGINE_ACCESS_KEY_ID && "VOLCENGINE_ACCESS_KEY_ID",
    !process.env.VOLCENGINE_SECRET_KEY && "VOLCENGINE_SECRET_KEY",
    !asrAppId && "VOLCENGINE_ASR_APP_ID",
    !ttsAppId && "VOLCENGINE_TTS_APP_ID",
    !dashscopeKey && "DASHSCOPE_API_KEY",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  const body = {
    AppId: appId,
    RoomId: params.roomId,
    TaskId: params.taskId,
    Config: {
      ASRConfig: {
        Provider: "volcano",
        ProviderParams: {
          AppId: asrAppId,
          AccessToken: asrToken,
          Cluster: "volcengine_streaming_common",
        },
        VADConfig: {
          SilenceTime: 600,
        },
        InterruptConfig: {
          InterruptSpeechDuration: 300,
        },
      },
      LLMConfig: {
        Provider: "custom",
        ProviderParams: {
          Url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
          APIKey: dashscopeKey,
          Model: aiModel,
          Messages: [
            {
              role: "system",
              content: params.systemPrompt,
            },
          ],
        },
      },
      TTSConfig: {
        Provider: "volcano",
        ProviderParams: {
          AppId: ttsAppId,
          AccessToken: ttsToken,
          VoiceType: params.voiceType ?? "BV701_streaming",
        },
      },
    },
    AgentConfig: {
      UserId: params.agentUserId,
      TargetUserId: [params.targetUserId],
      WelcomeMessage: params.welcomeMessage ?? "",
    },
  };

  return callRTCAPI("StartVoiceChat", "2024-12-01", body);
}

// ---------------------------------------------------------------------------
// StopVoiceChat
// ---------------------------------------------------------------------------

export async function stopVoiceChat(roomId: string, taskId: string) {
  const appId = process.env.VOLCENGINE_RTC_APP_ID ?? "";
  return callRTCAPI("StopVoiceChat", "2024-12-01", {
    AppId: appId,
    RoomId: roomId,
    TaskId: taskId,
  });
}

// ---------------------------------------------------------------------------
// Build system prompt for the AI interviewer
// ---------------------------------------------------------------------------

export function buildInterviewerPrompt(data: {
  mins: string;
  name: string;
  objective: string;
  questions: string;
  language: "zh" | "en";
  interviewer?: { empathy: number; exploration: number; rapport: number; speed: number };
}): string {
  const iv = data.interviewer;
  if (data.language === "zh") {
    const styleNote = iv
      ? `\n面试风格：共情力${iv.empathy}/10，亲和力${iv.rapport}/10，探索力${iv.exploration}/10，语速${iv.speed}/10。共情力高时多关注情感体验，探索力高时深度追问细节，亲和力高时语气温暖亲切，语速高时节奏更快、问题更紧凑。`
      : "";
    return `你是一位专业的面试官，擅长追问以挖掘深层洞察。面试时长不超过${data.mins}分钟。${styleNote}
被面试者姓名：${data.name}。
面试目标：${data.objective}。
参考问题：${data.questions}。
每问一个问题后必须追问一个跟进问题。
对话规范：专业而友好，问题不超过30个字，不重复问题，不讨论与目标无关的话题，如果知道对方姓名则在对话中使用。`;
  }
  const styleNote = iv
    ? `\nInterviewing style: empathy ${iv.empathy}/10, rapport ${iv.rapport}/10, exploration ${iv.exploration}/10, speed ${iv.speed}/10. Higher empathy means focusing on emotional experience; higher exploration means probing deeper into details; higher rapport means warmer, friendlier tone; higher speed means faster pacing and more concise exchanges.`
    : "";
  return `You are an expert interviewer who asks follow-up questions to uncover deeper insights. Keep the interview under ${data.mins} minutes.${styleNote}
Interviewee name: ${data.name}.
Interview objective: ${data.objective}.
Reference questions: ${data.questions}.
After each question, ask one follow-up question.
Guidelines: professional yet friendly tone, questions under 30 words, no repeated questions, stay on topic, use the interviewee's name if provided.`;
}

// ---------------------------------------------------------------------------
// Parse binary subtitle message from onRoomBinaryMessageReceived
// Returns null if the message cannot be parsed
// ---------------------------------------------------------------------------

export interface SubtitleMessage {
  role: "agent" | "user";
  text: string;
  isFinal: boolean;
}

export function parseSubtitleMessage(
  buffer: ArrayBuffer,
  senderId: string,
  agentUserId: string,
): SubtitleMessage | null {
  try {
    // The message payload may have a binary TLV header before the JSON.
    // We search for the first '{' to locate the JSON start.
    const bytes = new Uint8Array(buffer);
    let jsonStart = 0;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0x7b) {
        // '{'
        jsonStart = i;
        break;
      }
    }
    const jsonBytes = buffer.slice(jsonStart);
    const jsonStr = new TextDecoder("utf-8").decode(jsonBytes);
    const data = JSON.parse(jsonStr);

    const text: string = data.text ?? data.content ?? data.Text ?? "";
    if (!text.trim()) return null;

    const isFinal: boolean =
      data.definite === true || data.is_final === true || data.Definite === true;

    const role: "agent" | "user" = senderId === agentUserId ? "agent" : "user";
    return { role, text, isFinal };
  } catch {
    return null;
  }
}
