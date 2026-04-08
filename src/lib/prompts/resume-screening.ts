export const RESUME_SCREENING_SYSTEM_PROMPT =
  "你是一位资深HR和技术招聘专家，擅长分析简历与职位的匹配度。请严格按照要求的JSON格式返回结果，不要返回任何其他内容。";

export const getResumeScreeningPrompt = (
  jobDescription: string,
  resumeText: string,
) => `请根据以下职位描述，分析这份简历，提取关键信息并评估匹配度。

### 职位描述:
${jobDescription}

### 简历内容:
${resumeText}

请严格按以下JSON格式返回（不要返回任何其他内容，不要使用markdown代码块）:
{
  "name": "申请人姓名",
  "company": "最近/当前公司名称",
  "position": "最近/当前职位",
  "phone": "申请人手机/电话号码，如简历中未提供则返回null",
  "summary": "一句话亮点总结，最多包含5个关键词，例如：10年经验，teams后端，熟悉微服务与分布式系统",
  "score": 85
}

评分标准 (0-100):
- 90-100: 技能、经验、行业高度匹配，是理想候选人
- 70-89: 大部分技能匹配，经验相关，值得面试
- 50-69: 部分技能匹配，有一定相关性
- 30-49: 匹配度较低，仅少量技能相关
- 0-29: 几乎不匹配`;
