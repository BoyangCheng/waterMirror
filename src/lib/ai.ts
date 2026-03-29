import OpenAI from "openai";

// 通义千问 OpenAI 兼容客户端
const ai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

export default ai;

// 模型常量
export const AI_MODELS = {
  smart: process.env.AI_MODEL_SMART ?? "qwen-plus",
  fast: process.env.AI_MODEL_FAST ?? "qwen-turbo",
} as const;
