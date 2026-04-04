import crypto from "crypto";

// ---------------------------------------------------------------------------
// RTC Token Generation
// Ref: https://github.com/volcengine/rtc-aigc-demo/blob/main/Server/token.js
//
// 格式 (Little-Endian):
//   token = "001" + appId + base64(content)
//   content = uint16LE(msgLen) + msgBytes + uint16LE(sigLen) + sigBytes
//   msgBytes = uint32LE(nonce) + uint32LE(issuedAt) + uint32LE(expireAt)
//            + packString(roomId) + packString(userId) + packTreeMap(privileges)
//   sigBytes = HMAC-SHA256(appKey, msgBytes)
//
// 版本号 "001" 和 appId 以明文前缀拼接，不参与 base64
// ---------------------------------------------------------------------------

// Privilege 常量 (与官方 SDK 一致)
const PrivPublishStream   = 0;
const PrivSubscribeStream = 4;

// ---- ByteBuf: Little-Endian binary buffer helper ----
class ByteBuf {
  private buffer: Buffer;
  private position: number;

  constructor() {
    this.buffer = Buffer.alloc(1024);
    this.position = 0;
  }

  private ensureCapacity(len: number) {
    if (this.position + len > this.buffer.length) {
      const newBuf = Buffer.alloc(this.buffer.length * 2 + len);
      this.buffer.copy(newBuf);
      this.buffer = newBuf;
    }
  }

  putUint16(v: number): this {
    this.ensureCapacity(2);
    this.buffer.writeUInt16LE(v, this.position);
    this.position += 2;
    return this;
  }

  putUint32(v: number): this {
    this.ensureCapacity(4);
    this.buffer.writeUInt32LE(v >>> 0, this.position);
    this.position += 4;
    return this;
  }

  putBytes(bytes: Buffer): this {
    this.ensureCapacity(2 + bytes.length);
    this.buffer.writeUInt16LE(bytes.length, this.position);
    this.position += 2;
    bytes.copy(this.buffer, this.position);
    this.position += bytes.length;
    return this;
  }

  putString(str: string): this {
    return this.putBytes(Buffer.from(str, "utf8"));
  }

  putTreeMapUInt32(map: Map<number, number>): this {
    this.ensureCapacity(2);
    this.buffer.writeUInt16LE(map.size, this.position);
    this.position += 2;
    for (const [k, v] of map) {
      this.putUint16(k);
      this.putUint32(v);
    }
    return this;
  }

  pack(): Buffer {
    return Buffer.from(this.buffer.subarray(0, this.position));
  }
}

const VERSION = "001";

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

  // ---- 构建 msg (二进制, Little-Endian) ----
  const msgBuf = new ByteBuf();
  msgBuf.putUint32(nonce);
  msgBuf.putUint32(now);       // issuedAt
  msgBuf.putUint32(expireAt);
  msgBuf.putString(roomId);
  msgBuf.putString(userId);
  msgBuf.putTreeMapUInt32(privileges);
  const msgBytes = msgBuf.pack();

  // ---- 签名 ----
  const sigBytes = crypto.createHmac("sha256", appKey).update(msgBytes).digest();

  // ---- 组装 content: putBytes(msg) + putBytes(sig) ----
  const contentBuf = new ByteBuf();
  contentBuf.putBytes(msgBytes);
  contentBuf.putBytes(sigBytes);
  const content = contentBuf.pack();

  // ---- 最终 token: "001" + appId + base64(content) ----
  return VERSION + appId + content.toString("base64");
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

  const text = await res.text();
  console.log(`[RTC] callRTCAPI ${action} status=${res.status} body=${text.substring(0, 500)}`);

  if (!res.ok) {
    throw new Error(`Volcengine RTC API error [${action}]: ${res.status} ${text}`);
  }

  const json = JSON.parse(text);

  // Volcengine may return 200 with an error in ResponseMetadata
  if (json?.ResponseMetadata?.Error?.Code) {
    const err = json.ResponseMetadata.Error;
    throw new Error(`Volcengine RTC API error [${action}]: ${err.Code} - ${err.Message}`);
  }

  return json;
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

  // Body format follows the official rtc-aigc-demo:
  // https://github.com/volcengine/rtc-aigc-demo/blob/main/Server/scenes/Custom.json
  const body = {
    AppId: appId,
    RoomId: params.roomId,
    TaskId: params.taskId,
    Config: {
      ASRConfig: {
        Provider: "volcano",
        ProviderParams: {
          Mode: "smallmodel",
          AppId: asrAppId,
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
        Mode: "CustomLLM",
        Url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        APIKey: dashscopeKey,
        ModelName: aiModel,
        SystemMessages: [params.systemPrompt],
      },
      TTSConfig: {
        Provider: "volcano",
        ProviderParams: {
          app: {
            appid: ttsAppId,
            token: ttsToken || undefined,
            cluster: "volcano_tts",
          },
          audio: {
            voice_type: params.voiceType ?? "BV701_streaming",
            speed_ratio: 1,
            pitch_ratio: 1,
            volume_ratio: 1,
          },
        },
      },
      InterruptMode: 0,
    },
    AgentConfig: {
      UserId: params.agentUserId,
      TargetUserId: [params.targetUserId],
      WelcomeMessage: params.welcomeMessage ?? "",
      EnableConversationStateCallback: true,
    },
  };

  const result = await callRTCAPI("StartVoiceChat", "2024-12-01", body);
  console.log("[RTC] StartVoiceChat response:", JSON.stringify(result));
  return result;
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
// Parse binary TLV message from onRoomBinaryMessageReceived
// TLV format: 4-byte type (ASCII) + 4-byte length (BE uint32) + value (UTF-8)
// Message types: "conv" = agent state, "subv" = subtitle, "tool" = function call
// Ref: https://github.com/volcengine/rtc-aigc-demo/blob/main/src/utils/utils.ts
// ---------------------------------------------------------------------------

export interface SubtitleMessage {
  role: "agent" | "user";
  text: string;
  isFinal: boolean;
}

/**
 * Decode a TLV binary message into { type, value }
 */
function tlv2String(buffer: ArrayBuffer): { type: string; value: string } {
  const view = new DataView(buffer);
  const decoder = new TextDecoder("utf-8");

  // First 4 bytes: type (ASCII string like "subv", "conv", "tool")
  const typeBytes = new Uint8Array(buffer, 0, 4);
  const type = decoder.decode(typeBytes);

  // Next 4 bytes: length of value (big-endian uint32)
  const length = view.getUint32(4, false); // big-endian

  // Remaining bytes: UTF-8 encoded JSON string
  const valueBytes = new Uint8Array(buffer, 8, length);
  const value = decoder.decode(valueBytes);

  return { type, value };
}

export function parseSubtitleMessage(
  buffer: ArrayBuffer,
  senderId: string,
  agentUserId: string,
): SubtitleMessage | null {
  try {
    const { type, value } = tlv2String(buffer);
    console.log("[RTC] binary message type:", type, "length:", buffer.byteLength);

    // Only handle subtitle messages ("subv")
    if (type !== "subv") {
      console.log("[RTC] non-subtitle message type:", type, "value:", value.substring(0, 100));
      return null;
    }

    const parsed = JSON.parse(value);
    console.log("[RTC] subtitle parsed:", JSON.stringify(parsed).substring(0, 200));

    // Subtitle data is nested under data[0]
    // Structure: { data: [{ text, definite, userId, paragraph }] }
    const item = parsed.data?.[0] ?? parsed;
    const text: string = item.text ?? item.content ?? item.Text ?? "";
    if (!text.trim()) return null;

    const isFinal: boolean = item.definite === true || item.is_final === true;

    // Use userId from the message payload if available, otherwise fall back to senderId
    const msgUserId: string = item.userId ?? item.user_id ?? senderId;
    const role: "agent" | "user" = msgUserId === agentUserId ? "agent" : "user";

    return { role, text, isFinal };
  } catch (err) {
    // Fallback: try parsing as raw JSON (no TLV header)
    try {
      const bytes = new Uint8Array(buffer);
      let jsonStart = 0;
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0x7b) { jsonStart = i; break; }
      }
      const jsonStr = new TextDecoder("utf-8").decode(buffer.slice(jsonStart));
      console.log("[RTC] fallback JSON parse:", jsonStr.substring(0, 200));
      const data = JSON.parse(jsonStr);
      const item = data.data?.[0] ?? data;
      const text: string = item.text ?? item.content ?? "";
      if (!text.trim()) return null;
      const isFinal: boolean = item.definite === true || item.is_final === true;
      const msgUserId: string = item.userId ?? item.user_id ?? senderId;
      const role: "agent" | "user" = msgUserId === agentUserId ? "agent" : "user";
      return { role, text, isFinal };
    } catch {
      console.warn("[RTC] failed to parse binary message, length:", buffer.byteLength);
      return null;
    }
  }
}
