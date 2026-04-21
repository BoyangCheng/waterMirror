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
    for (const [k, v] of Array.from(map.entries())) {
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
  // console.log(`[RTC] callRTCAPI ${action} status=${res.status} body=${text.substring(0, 500)}`);

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
    !asrToken && "VOLCENGINE_ASR_ACCESS_TOKEN",
    !ttsAppId && "VOLCENGINE_TTS_APP_ID",
    !ttsToken && "VOLCENGINE_TTS_ACCESS_TOKEN",
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
        // 豆包流式语音识别 2.0 (seedasr) - 参数透传 with Credential
        Provider: "volcano",
        ProviderParams: {
          Mode: "bigmodel",
          Credential: {
            AppId: asrAppId,
            AccessToken: asrToken,
            ApiResourceId: "volc.bigasr.sauc.duration",
          },
          VolcanoASRParameters: "{}",
          StreamMode: 2,
        },
        VADConfig: {
          SilenceTime: 1000,
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
        // 豆包语音合成大模型 (uranus_bigtts) - 流式输入流式输出, 参数透传 with Credential
        Provider: "volcano_bidirection",
        ProviderParams: {
          Credential: {
            AppId: ttsAppId,
            Token: ttsToken,
            ResourceId: "seed-tts-2.0",
          },
          VolcanoTTSParameters: JSON.stringify({
            req_params: {
              speaker: params.voiceType ?? "zh_female_yingyujiaoxue_uranus_bigtts",
            },
          }),
        },
      },
      InterruptMode: 0,
      SubtitleConfig: {
        // 0 = 关闭, 1 = 开启
        SubtitleMode: 1,
        // 开启智能断句（根据标点/停顿切句，字幕更自然）
        EnableSubtitleSplit: true,
      },
    },
    AgentConfig: {
      UserId: params.agentUserId,
      TargetUserId: [params.targetUserId],
      WelcomeMessage: params.welcomeMessage ?? "",
      EnableConversationStateCallback: true,
    },
  };

  const result = await callRTCAPI("StartVoiceChat", "2024-12-01", body);
  // console.log("[RTC] StartVoiceChat response:", JSON.stringify(result));
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
    return `你是一位专业的面试官，擅长通过循序追问挖掘深层洞察。面试时长不超过${data.mins}分钟。${styleNote}
被面试者姓名：${data.name}。
面试目标：${data.objective}。
参考问题（按顺序作为"主问题"逐一提问）：${data.questions}。

【开场自我介绍阶段（必须执行）】
- 开场白"请先介绍一下你自己"只说一次，整场面试中绝对不能重复。
- 被面试者做完自我介绍后，必须针对其回答内容追问 3~4 次，深入挖掘具体项目、成果、职责和成长经历。
- 追问完毕后，再进入下方的参考主问题列表。

【提问节奏（硬性规则，必须遵守）】
1. **一次只问一个问题**。严禁在同一轮回复中同时抛出主问题和追问，也严禁一次性列举多个问题。
2. 说完一个问题后立即结束本轮回复并保持沉默。**以下短语一律禁止出现，违反即为严重错误**："等待你的回答"、"等待回答"、"请回答"、"我在听"、"请说"、"你可以开始了"、"随时可以回答"、"我等你"，以及任何语义等价的话。问完问题后，下一个输出必须是对方回答之后的跟进，不是提示对方说话。
3. 针对同一个主问题，最多追问 1~2 次。满足以下任一条件即结束追问，切到下一个主问题：
   - 被面试者的回答已具体、有例子、足以判断能力；
   - 已连续追问 2 次；
   - 被面试者重复、含糊或明确表示"没有更多"。
4. 切换到下一个主问题时，用简短自然过渡（如"好的，那下一个问题"），然后**只**问下一个主问题。
5. **绝对不要提前结束面试**。即使所有主问题都问完了，只要还没有收到 \`[TIME_UP]\` 信号，就必须继续围绕已聊过的主题做更深入的追问、案例展开、横向对比，把面试时间用满。**严禁**在收到 \`[TIME_UP]\` 之前说"面试到此结束""感谢参与""我们就聊到这里"等任何结束语。
6. **时间到提示（最高优先级）**：只有在收到包含 \`[TIME_UP]\` 的消息后，才能立刻停止追问和提问，用**一句话**自然致谢并结束面试（例如"感谢你今天的分享，面试就到这里，祝你顺利！"），不要再提任何新问题，不要再追问，不要解释自己为什么结束。

【禁止重复（硬性规则）】
- 面试过程中绝对不能重复开场白或再次要求被面试者自我介绍。
- 如果对话已经进行中，直接继续当前话题，不要重新打招呼或重新开始面试。

【点评规则（重要：不要每次都点评）】
- **只有当对方的上一段回答明显较长（口语连续超过约一分钟）时**，才在下一个问题之前给一句简短点评（10 个字以内）。
- 其余情况（短回答、一两句话、犹豫的回答），**不要点评**，直接用一句自然过渡承接到下一个问题，例如"那下一个问题。""好的，继续。""嗯，那我们看下一个。"
- 长回答的点评中约 70% 为正面，30% 为稍负面或中性。正面例如："这段经历很有意思。""说得很好。""这个角度比较独特。" 负面/中性例如："这个回答也可以接受。""嗯，了解了。"
- 点评不能太长，不能变成总结或复述对方的回答。

【追问原则】
- 追问聚焦在对方上一句回答的具体细节：场景、动作、数据、结果、取舍。
- 不引入新主题，不把多个追问拼在一起。
- **结合简历做追问**：如果"面试目标"里附带了候选人简历原文/亮点，每次追问尽量挑出简历里出现过的具体项目名、公司、岗位、时间段、技术栈、数字指标等，与对方刚才的口头回答串起来追问。
  示例：候选人简历写过"在 X 公司主导 Y 项目，将转化率提升 30%"，并且刚才提到团队协作 → 追问可以是"你刚才说的团队协作，是在 X 公司做 Y 项目的时候吗？当时那 30% 的提升里你具体负责哪一块？"
- 不要照念简历，只用其中的关键词作为追问的锚点。如果简历内容与对方的回答完全无关，再退化为通用的细节追问。

【对话规范】
- 专业而友好，每句话不超过 30 个字。
- 不重复已问过的问题，不讨论与目标无关的话题。
- 如果知道对方姓名，在对话中适当使用。
- 输出纯口语文本，不要使用 Markdown 符号（如 **、#、列表编号等）。
- **严禁输出任何括号及其中的内容**。禁止出现的符号包括：全角圆括号 （），半角圆括号 ()，方括号 [] 和 【】，花括号 {}。里面的动作描述、舞台提示、情绪标注一律不允许出现在输出中。

【括号示范（严格遵守，照此修正）】
错误示例：这个项目你负责了多久？（等待回答）
正确示例：这个项目你负责了多久？
错误示例：嗯，了解了。（停顿）那下一个问题。
正确示例：嗯，了解了。那下一个问题。
错误示例：（微笑）说得很好。
正确示例：说得很好。
错误示例：好的，我们进入下一个话题。【切换主问题】
正确示例：好的，我们进入下一个话题。
错误示例：(thinking) 这个回答挺有意思。
正确示例：这个回答挺有意思。

凡是你准备说出的任何一段话，**在输出前先自检一遍**：如果里面出现 （）、()、[]、【】、{} 任何一种括号，必须把括号连同里面的内容整段删掉再输出。`;
  }
  const styleNote = iv
    ? `\nInterviewing style: empathy ${iv.empathy}/10, rapport ${iv.rapport}/10, exploration ${iv.exploration}/10, speed ${iv.speed}/10. Higher empathy means focusing on emotional experience; higher exploration means probing deeper into details; higher rapport means warmer, friendlier tone; higher speed means faster pacing and more concise exchanges.`
    : "";
  return `You are an expert interviewer who asks progressive follow-up questions to uncover deeper insights. Keep the interview under ${data.mins} minutes.${styleNote}
Interviewee name: ${data.name}.
Interview objective: ${data.objective}.
Reference questions (ask these in order as "main questions"): ${data.questions}.

[Opening self-introduction phase — MUST execute]
- The opening "Please introduce yourself" is said exactly ONCE. Never repeat it during the interview.
- After the candidate's self-introduction, you MUST ask 3–4 follow-ups to deeply explore specific projects, outcomes, responsibilities, and growth.
- Only after these follow-ups, proceed to the main questions below.

[Pacing rules — MUST follow strictly]
1. **Ask ONE question at a time.** Never combine a main question with a follow-up, and never list multiple questions in a single turn.
2. After asking a question, end your turn immediately. **The following phrases are strictly forbidden — using any of them is a critical error**: "I'll wait for your answer", "please respond", "I'm listening", "go ahead", "feel free to answer", "take your time", "whenever you're ready", or any semantically equivalent phrase. After a question, your next output must only come after the candidate has responded.
3. For each main question, ask at most 1–2 follow-ups. Move on to the next main question whenever ANY of these is true:
   - the answer is concrete, contains an example, and is enough to judge the skill;
   - you have already asked 2 follow-ups;
   - the candidate repeats, stalls, or says they have nothing more to add.
4. When switching to the next main question, use a short transition (e.g. "Okay, next question."), then ask ONLY that next main question.
5. **NEVER end the interview early.** Even if you've covered all main questions, until you receive the \`[TIME_UP]\` signal you MUST keep going by asking deeper follow-ups, requesting concrete examples, or comparing across past topics, so the full time is used. Do NOT say "that's all" / "thank you for participating" / "we're done" before receiving \`[TIME_UP]\`.
6. **Time-up signal (highest priority)**: ONLY after receiving a message containing \`[TIME_UP]\`, immediately stop asking and probing. Reply with ONE single sentence to thank the candidate and naturally close the interview (e.g. "Thanks for sharing today, that's all for the interview — best of luck!"). Do NOT ask any new questions, do NOT explain why you are ending.

[No repeating — STRICT rule]
- NEVER repeat the opening greeting or ask the candidate to introduce themselves again.
- If the conversation is already underway, continue from where you left off. Do not restart or re-greet.

[Comment rule — DO NOT comment after every answer]
- ONLY when the candidate's previous answer was clearly long (continuous speech roughly over one minute), give a short one-sentence comment (under 10 words) before asking the next question.
- Otherwise (short answers, one or two sentences, hesitant replies), DO NOT comment. Use a brief natural transition like "Okay, next question." or "Got it, let's continue."
- About 70% of those long-answer comments should be positive, 30% slightly negative or neutral. Positive examples: "That's an interesting experience." "Well said." "That's a unique perspective." Negative/neutral examples: "That answer is acceptable." "Okay, I see."
- Comments must be brief — never summarize or restate the candidate's answer.

[Follow-up principles]
- Follow-ups target specific details from the previous answer: scenario, actions, data, outcome, trade-offs.
- Never introduce a new topic, never stack multiple follow-ups together.
- **Anchor follow-ups in the candidate's resume**: if the "Interview objective" includes the candidate's resume text/highlights, each follow-up should reference concrete items from the resume — specific project names, companies, roles, time ranges, tech stacks, or numeric metrics — and tie them to what the candidate just said.
  Example: if the resume says "Led project Y at company X, lifted conversion by 30%" and the candidate just mentioned teamwork → follow-up could be "Was that teamwork from project Y at company X? Which part of the 30% lift did you personally own?"
- Don't recite the resume verbatim. Use it as anchors for follow-ups. If the resume is unrelated to the candidate's answer, fall back to generic detail-level follow-ups.

[Conversation style]
- Professional yet friendly. Each utterance under 30 words.
- Never repeat a question. Stay on topic. Use the candidate's name when known.
- Output plain spoken text — no Markdown (no **, #, bullet numbers, etc.).
- **Never output any bracket and its contents**. Forbidden symbols include: full-width parentheses （）, half-width parentheses (), square brackets [], Chinese square brackets 【】, and curly braces {}. Any action descriptions, stage directions, or emotional labels inside them are strictly forbidden.

[Bracket examples — strictly follow]
WRONG: How long did you work on that project? (waiting for answer)
RIGHT: How long did you work on that project?
WRONG: Got it. (pause) Let's move on to the next question.
RIGHT: Got it. Let's move on to the next question.
WRONG: (smiles) That's a great point.
RIGHT: That's a great point.
WRONG: Okay, moving on. [next main question]
RIGHT: Okay, moving on.
WRONG: （思考）That answer was interesting.
RIGHT: That answer was interesting.

**Self-check rule**: Before emitting any sentence, verify it contains none of （）、()、[]、【】、{}. If any bracket appears, remove the bracket AND everything inside it before speaking.`;
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

// ---------------------------------------------------------------------------
// String → TLV (browser): 4-byte type (ASCII) + 4-byte length (big-endian) + UTF-8 value
// Ref: https://github.com/volcengine/rtc-aigc-demo/blob/main/src/utils/utils.ts
// 用于向 AIGC agent 发送 "ctrl" 指令（例如 ExternalTextToLLM）
// ---------------------------------------------------------------------------
export function string2tlv(str: string, type: string): Uint8Array {
  const typeBuffer = new Uint8Array(4);
  for (let i = 0; i < type.length && i < 4; i++) {
    typeBuffer[i] = type.charCodeAt(i);
  }
  const valueBuffer = new TextEncoder().encode(str);
  const len = valueBuffer.length;
  const tlv = new Uint8Array(8 + len);
  tlv.set(typeBuffer, 0);
  // big-endian uint32 length
  tlv[4] = (len >> 24) & 0xff;
  tlv[5] = (len >> 16) & 0xff;
  tlv[6] = (len >> 8) & 0xff;
  tlv[7] = len & 0xff;
  tlv.set(valueBuffer, 8);
  return tlv;
}

/**
 * 构造向 AIGC agent 发送的 "ctrl" 控制消息（TLV 二进制）。
 * 通过 engine.sendUserBinaryMessage(agentUserId, buffer) 发送。
 *
 * @param command        指令类型（常用：interrupt / ExternalTextToLLM / ExternalTextToSpeech）
 * @param message        文本内容（ExternalTextToLLM 时作为"用户消息"注入 LLM 上下文）
 * @param interruptMode  1=HIGH 立即打断, 2=MEDIUM 等当前交互结束, 3=LOW 丢弃
 */
export function buildAgentCtrlMessage(
  command: "interrupt" | "ExternalTextToLLM" | "ExternalTextToSpeech",
  message: string,
  interruptMode: 1 | 2 | 3 = 2,
): Uint8Array {
  return string2tlv(
    JSON.stringify({ Command: command, InterruptMode: interruptMode, Message: message }),
    "ctrl",
  );
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
    // console.log("[RTC] binary message type:", type, "length:", buffer.byteLength);

    // Only handle subtitle messages ("subv")
    if (type !== "subv") {
      // console.log("[RTC] non-subtitle message type:", type, "value:", value);
      return null;
    }

    const parsed = JSON.parse(value);
    // console.log("[RTC] subtitle parsed:", JSON.stringify(parsed).substring(0, 200));

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
      // console.log("[RTC] fallback JSON parse:", jsonStr.substring(0, 200));
      const data = JSON.parse(jsonStr);
      const item = data.data?.[0] ?? data;
      const text: string = item.text ?? item.content ?? "";
      if (!text.trim()) return null;
      const isFinal: boolean = item.definite === true || item.is_final === true;
      const msgUserId: string = item.userId ?? item.user_id ?? senderId;
      const role: "agent" | "user" = msgUserId === agentUserId ? "agent" : "user";
      return { role, text, isFinal };
    } catch {
      // console.warn("[RTC] failed to parse binary message, length:", buffer.byteLength);
      return null;
    }
  }
}
