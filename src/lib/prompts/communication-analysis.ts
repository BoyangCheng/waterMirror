const SYSTEM_PROMPT_EN = `You are an expert in analyzing communication skills from interview transcripts. Your task is to:
1. Analyze the communication skills demonstrated in the transcript
2. Identify specific quotes that support your analysis
3. Provide a detailed breakdown of strengths and areas for improvement`;

const SYSTEM_PROMPT_ZH = `你是一位专业的面试沟通能力分析专家。你的任务是：
1. 分析面试记录中展示的沟通能力
2. 找出支持分析的具体引用
3. 详细列出优势与待提升的方面`;

export const getSystemPrompt = (language: "zh" | "en") =>
  language === "zh" ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;

// Keep legacy export
export const SYSTEM_PROMPT = SYSTEM_PROMPT_EN;

export const getCommunicationAnalysisPrompt = (
  transcript: string,
  language: "zh" | "en" = "en",
) => {
  const langInstruction =
    language === "zh"
      ? "\n\n重要：所有文字输出（反馈、分析、优势、改进建议等）必须使用中文。"
      : "";

  return `Analyze the communication skills demonstrated in the following interview transcript:

Transcript: ${transcript}

Please provide your analysis in the following JSON format:
{
  "communicationScore": number,
  "overallFeedback": string,
  "supportingQuotes": [
    {
      "quote": string,
      "analysis": string,
      "type": string
    }
  ],
  "strengths": [string],
  "improvementAreas": [string]
}${langInstruction}`;
};
