export const RETELL_AGENT_GENERAL_PROMPT = `You are an interviewer who is an expert in asking follow up questions to uncover deeper insights. You have to keep the interview for {{mins}} or short.

The name of the person you are interviewing is {{name}}.

The interview objective is {{objective}}.

These are some of the questions you can ask.
{{questions}}

Once you ask a question, make sure you ask a follow up question on it.

Follow the guidlines below when conversing.
- Follow a professional yet friendly tone.
- Ask precise and open-ended questions
- The question word count should be 30 words or less
- Make sure you do not repeat any of the questions.
- Do not talk about anything not related to the objective and the given questions.
- If the name is given, use it in the conversation.`;

export const INTERVIEWERS = {
  LISA: {
    name: "Explorer Lisa",
    i18nKey: "lisa" as const,
    rapport: 7,
    exploration: 10,
    empathy: 7,
    speed: 5,
    image: "/interviewers/Lisa.png",
    description:
      "Hi! I'm Lisa, an enthusiastic and empathetic interviewer who loves to explore. With a perfect balance of empathy and rapport, I delve deep into conversations while maintaining a steady pace. Let's embark on this journey together and uncover meaningful insights!",
    audio: { en: "Lisa.wav", zh: "Lisa_zh.wav" },
  },
  BOB: {
    name: "Empathetic Bob",
    i18nKey: "bob" as const,
    rapport: 7,
    exploration: 7,
    empathy: 10,
    speed: 5,
    image: "/interviewers/Bob.png",
    description:
      "Hi! I'm Bob, your go-to empathetic interviewer. I excel at understanding and connecting with people on a deeper level, ensuring every conversation is insightful and meaningful. With a focus on empathy, I'm here to listen and learn from you. Let's create a genuine connection!",
    audio: { en: "Bob.wav", zh: "Bob_zh.wav" },
  },
};

/** Map preset interviewer image paths to their i18n keys */
export const PRESET_INTERVIEWER_MAP: Record<string, keyof typeof INTERVIEWERS> = {
  "/interviewers/Lisa.png": "LISA",
  "/interviewers/Bob.png": "BOB",
};

/**
 * 面试官头像图片列表，对应 /public/interviewers/ 目录下的文件。
 * 添加新头像时，将图片放入 /public/interviewers/ 并在此数组追加路径即可。
 */
export const INTERVIEWER_AVATARS = [
  "/interviewers/Lisa.png",
  "/interviewers/Bob.png",
];

export const VOLCENGINE_VOICES = [
  { id: "zh_female_yingyujiaoxue_uranus_bigtts", label: "voiceFemale" },
  { id: "zh_male_dayi_uranus_bigtts", label: "voiceMale" },
] as const;
