export const SYSTEM_PROMPT =
  "You are an expert in uncovering deeper insights from interview question and answer sets.";

export const getSystemPrompt = (language: "zh" | "en" = "en") => {
  if (language === "zh") {
    return "你是一位擅长从面试问答中挖掘深层洞察的专家。";
  }
  return SYSTEM_PROMPT;
};

export const createUserPrompt = (
  callSummaries: string,
  interviewName: string,
  interviewObjective: string,
  interviewDescription: string,
  language: "zh" | "en" = "en",
) => {
  if (language === "zh") {
    return `你是一位专业面试官，擅长从通话摘要中挖掘深层洞察。
根据以下通话摘要和面试详情生成洞察。

###
通话摘要：${callSummaries}

###
面试标题：${interviewName}
面试目标：${interviewObjective}
面试描述：${interviewDescription}

请从通话摘要中提炼3条洞察，突出用户反馈。不要包含用户姓名，每条洞察不超过25个字。
以JSON格式输出，键名为"insights"，值为包含3条洞察的数组。`;
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
