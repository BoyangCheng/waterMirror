const SYSTEM_PROMPT_EN =
  "You are an expert in coming up with follow up questions to uncover deeper insights.";

const SYSTEM_PROMPT_ZH =
  "你是一位专业的面试问题设计专家，擅长设计深度挖掘洞察的追问问题。";

export const getSystemPrompt = (language: "zh" | "en") =>
  language === "zh" ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;

// Keep legacy export for backward compatibility
export const SYSTEM_PROMPT = SYSTEM_PROMPT_EN;

export const generateQuestionsPrompt = (
  body: { name: string; objective: string; number: number; context: string },
  language: "zh" | "en" = "en",
) => {
  if (language === "zh") {
    return `你是一位专业的面试官，擅长设计面试问题，帮助招聘方找到具有丰富技术知识和项目经验的候选人。

面试标题：${body.name}
面试目标：${body.objective}

需要生成的问题数量：${body.number}

设计问题时请遵循以下详细指南：
- 重点评估候选人的技术知识和相关项目经验。问题应着重考察专业深度、解决问题的能力以及实际项目经验，这些方面权重最高。
- 包含通过实际案例评估解决问题能力的问题，例如候选人如何应对过往项目中的挑战，以及处理复杂技术问题的方法。
- 沟通能力、团队协作和适应能力等软技能也应涉及，但相比技术和解决问题的能力，权重较低。
- 保持专业而亲切的语气，让候选人在展示知识的同时感到自在。
- 提出简洁精准的开放性问题，鼓励详细作答。每个问题不超过 30 个字。

参考以下背景信息生成问题：
${body.context}

同时，生成一段不超过 50 字的第二人称面试描述，展示给受访者。描述放在 'description' 字段中。
描述不得直接使用目标原文。部分细节不对受访者展示。描述应简短清晰，让受访者了解面试内容。

'questions' 字段为对象数组，每个对象包含 question 键。

严格只输出包含 'questions' 和 'description' 两个键的 JSON 对象，所有内容使用中文。`;
  }

  return `Imagine you are an interviewer specialized in designing interview questions to help hiring managers find candidates with strong technical expertise and project experience, making it easier to identify the ideal fit for the role.

Interview Title: ${body.name}
Interview Objective: ${body.objective}

Number of questions to be generated: ${body.number}

Follow these detailed guidelines when crafting the questions:
- Focus on evaluating the candidate's technical knowledge and their experience working on relevant projects. Questions should aim to gauge depth of expertise, problem-solving ability, and hands-on project experience. These aspects carry the most weight.
- Include questions designed to assess problem-solving skills through practical examples. For instance, how the candidate has tackled challenges in previous projects, and their approach to complex technical issues.
- Soft skills such as communication, teamwork, and adaptability should be addressed, but given less emphasis compared to technical and problem-solving abilities.
- Maintain a professional yet approachable tone, ensuring candidates feel comfortable while demonstrating their knowledge.
- Ask concise and precise open-ended questions that encourage detailed responses. Each question should be 30 words or less for clarity.

Use the following context to generate the questions:
${body.context}

Moreover generate a 50 word or less second-person description about the interview to be shown to the user. It should be in the field 'description'.
Do not use the exact objective in the description. Remember that some details are not be shown to the user. It should be a small description for the
user to understand what the content of the interview would be. Make sure it is clear to the respondent who's taking the interview.

The field 'questions' should take the format of an array of objects with the following key: question.

Strictly output only a JSON object with the keys 'questions' and 'description'.`;
};
