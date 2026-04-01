const SYSTEM_PROMPT_EN =
  "You are an expert in uncovering deeper insights from interview question and answer sets.";

const SYSTEM_PROMPT_ZH =
  "你是一位专业的面试分析专家，擅长从面试问答中挖掘深层洞察。";

export const getSystemPrompt = (language: "zh" | "en") =>
  language === "zh" ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;

// Keep legacy export
export const SYSTEM_PROMPT = SYSTEM_PROMPT_EN;

export const createUserPrompt = (
  callSummaries: string,
  interviewName: string,
  interviewObjective: string,
  interviewDescription: string,
  language: "zh" | "en" = "en",
) => {
  if (language === "zh") {
    return `你是一位专业面试官，擅长从通话概要中挖掘深层洞察。
请根据以下通话概要和面试信息生成洞察。

###
通话概要：${callSummaries}

###
面试标题：${interviewName}
面试目标：${interviewObjective}
面试描述：${interviewDescription}

从通话概要中提炼 3 条突出用户反馈的洞察。只输出洞察内容，不要包含用户姓名。
每条洞察不超过 25 个字。

以 JSON 格式输出，键为 "insights"，值为包含 3 条洞察的数组。所有内容使用中文。`;
  }

  return `Imagine you are an interviewer who is an expert in uncovering deeper insights from call summaries.
    Use the list of call summaries and the interview details below to generate insights.

    ###
    Call Summaries: ${callSummaries}

    ###
    Interview Title: ${interviewName}
    Interview Objective: ${interviewObjective}
    Interview Description: ${interviewDescription}

    Give 3 insights from the call summaries that highlights user feedback. Only output the insights. Do not include user names in the insights.
    Make sure each insight is 25 words or less.

    Output the answer in JSON format with the key "insights" with an array on 3 insights as the value.`;
};
