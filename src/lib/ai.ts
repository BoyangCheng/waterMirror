import OpenAI from "openai";

// 通义千问 OpenAI 兼容客户端
// 注意：Next.js build 期会加载此模块做静态分析，此时 DASHSCOPE_API_KEY 尚未注入。
// 给一个占位符避免构建失败；运行时容器通过 docker compose env_file 注入真实 key。
const ai = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY || "BUILD_TIME_PLACEHOLDER",
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

export default ai;

// 模型常量
export const AI_MODELS = {
  smart: process.env.AI_MODEL_SMART ?? "qwen-plus",
  fast: process.env.AI_MODEL_FAST ?? "qwen-turbo",
} as const;
