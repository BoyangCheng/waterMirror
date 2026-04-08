const SYSTEM_PROMPT_EN =
  "You are an expert in analyzing interview transcripts. You must only use the main questions provided and not generate or infer additional questions.";

const SYSTEM_PROMPT_ZH =
  "你是一位专业的面试记录分析专家。你只能使用所提供的主要问题，不得生成或推断额外的问题。";

export const getSystemPrompt = (language: "zh" | "en") =>
  language === "zh" ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;

// Keep legacy export
export const SYSTEM_PROMPT = SYSTEM_PROMPT_EN;

export const getInterviewAnalyticsPrompt = (
  interviewTranscript: string,
  mainInterviewQuestions: string,
  language: "zh" | "en" = "en",
) => {
  const langInstruction =
    language === "zh"
      ? "\n\n重要：所有文字输出（反馈、概要、评语等）必须使用中文。"
      : "";

  return `Analyse the following interview transcript and provide structured feedback:

###
Transcript: ${interviewTranscript}

Main Interview Questions:
${mainInterviewQuestions}


Based on this transcript and the provided main interview questions, generate the following analytics in JSON format:
1. Overall Score (0-100) and Overall Feedback (60 words) - take into account the following factors:
   - Communication Skills: Evaluate the use of language, grammar, and vocabulary. Assess if the interviewee communicated effectively and clearly.
   - Time Taken to Answer: Consider if the interviewee answered promptly or took too long. Note if they were concise or tended to ramble.
   - Confidence: Assess the interviewee's confidence level. Were they assertive and self-assured, or did they seem hesitant and unsure?
   - Clarity: Evaluate the clarity of their answers. Were their responses well-structured and easy to understand?
   - Attitude: Consider the interviewee's attitude towards the interview and questions. Were they positive, respectful, and engaged?
   - Relevance of Answers: Determine if the interviewee's responses are relevant to the questions asked. Assess if they stayed on topic or veered off track.
   - Depth of Knowledge: Evaluate the interviewee's depth of understanding and knowledge in the subject matter. Look for detailed and insightful answers.
   - Problem-Solving Ability: Consider how the interviewee approaches problem-solving questions. Assess their logical reasoning and analytical skills.
   - Examples and Evidence: Note if the interviewee provides concrete examples or evidence to support their answers. This can indicate experience and credibility.
   - Listening Skills: Look for signs that the interviewee is actively listening and responding appropriately to follow-up questions.
   - Consistency: Evaluate if the interviewee's answers are consistent throughout the interview or if they contradict themselves.
   - Adaptability: Assess how well the interviewee adapts to different types of questions, including unexpected or challenging ones.

2. Communication Skills: Score (0-10) and Feedback (60 words).
3. Summary for each main interview question: ${mainInterviewQuestions}
   - Use ONLY the main questions provided, it should output all the questions with the numbers even if it's not found in the transcript.
   - If a main interview question isn't found in the transcript, output the main question and give the summary as "Not Asked"
   - If a main interview question is found in the transcript but an answer couldn't be found, output the main question and give the summary as "Not Answered"
   - If found and answered, provide a cohesive paragraph encompassing all related information for each main question
4. Create a 10 to 15 words summary regarding the soft skills considering factors such as confidence, leadership, adaptability, critical thinking and decision making.
5. Job Tendency: Assess the candidate's overall tendency towards this job based on their responses, enthusiasm, and engagement. Choose exactly one of: "positive" (clearly enthusiastic and eager), "optimistic" (generally open and willing but not strongly eager), "negative" (disinterested, reluctant, or unenthusiastic).

Ensure the output is in valid JSON format with the following structure:
{
  "overallScore": number,
  "overallFeedback": string,
  "communication": { "score": number, "feedback": string },
  "questionSummaries": [{ "question": string, "summary": string }],
  "softSkillSummary": string,
  "jobTendency": "positive" | "optimistic" | "negative"
}

IMPORTANT: Only use the main questions provided. Do not generate or infer additional questions such as follow-up questions.${langInstruction}`;
};
