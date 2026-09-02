import { env } from "@/lib/env";
import { normalizeInputText } from "@/lib/encoding";
import {
  ProjectChatCitation,
  ProjectChatMeta,
  ProjectChatRetrievalItem,
  ProjectData,
  RiskHit
} from "@/lib/types";
import { unique } from "@/lib/utils";
import { searchProjectVectors } from "@/lib/vector-search";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ProjectChatReply = {
  content: string;
  meta: ProjectChatMeta;
};

function resolveApiUrl() {
  if (env.qwenApiUrl.endsWith("/chat/completions")) {
    return env.qwenApiUrl;
  }

  return `${env.qwenApiUrl.replace(/\/$/, "")}/chat/completions`;
}

/** 单次 AI 请求超时（毫秒）。 */
const AI_TIMEOUT_MS = 25_000;
/** 可重试错误（限流/网关抖动）的最大重试次数。 */
const AI_MAX_RETRIES = 2;

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callModelOnce(model: string, messages: ChatMessage[]) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(resolveApiUrl(), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.qwenApiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages
      })
    });

    if (!response.ok) {
      const error = new Error(`AI 请求失败：${response.status}`);
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    if (typeof content === "string" && content.trim()) {
      return normalizeInputText(content, {
        preserveNewlines: true,
        maxLength: 1000
      });
    }

    throw new Error("AI 返回内容为空。");
  } finally {
    clearTimeout(timer);
  }
}

async function callQwen(messages: ChatMessage[]) {
  if (!env.qwenApiKey) {
    throw new Error("未配置 AI Key");
  }

  const models = unique([
    env.qwenPrimaryModel,
    ...env.qwenFallbackModels
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean)
  ]);

  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt += 1) {
      try {
        return await callModelOnce(model, messages);
      } catch (error) {
        lastError = error;

        // 超时（AbortError）与内容为空不重试，直接换下一个模型。
        if (error instanceof Error && error.name === "AbortError") {
          break;
        }

        const status = (error as Error & { status?: number }).status;
        if (typeof status === "number" && isRetryableStatus(status) && attempt < AI_MAX_RETRIES) {
          // 指数退避：500ms / 1000ms。
          await sleep(500 * 2 ** attempt);
          continue;
        }

        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI 调用失败");
}

function normalizeForMatch(text: string) {
  return text.toLowerCase().replace(/[\s，。！？、；:：()（）\-]+/g, "");
}

export function buildRiskExplanationFallback(risk: RiskHit) {
  const evidenceSummary = risk.evidence
    .slice(0, 2)
    .map((item) => item.summary)
    .join("；");

  return `${risk.summary} 已命中 ${risk.matchedKeywords.length} 个关键词和 ${risk.financialSignals.length} 个财务信号。核心依据：${
    evidenceSummary || "当前以规则信号为主"
  }。建议优先执行：${risk.auditProcedures[0]}`;
}

export async function explainRisk(risk: RiskHit, project: ProjectData) {
  try {
    return await callQwen([
      {
        role: "system",
        content:
          "你是零售行业审计经理。只基于给定证据解释风险，不虚构数据，不超过180字，语气专业简洁。"
      },
      {
        role: "user",
        content: `项目：${project.companyName} ${project.year}
风险：${risk.title}
评分：${risk.score}
关键词：${risk.matchedKeywords.join("、") || "无"}
财务信号：${risk.financialSignals.join("、") || "无"}
证据：${risk.evidence.map((item) => `${item.fileName}:${item.summary}`).join("；")}
请给出风险解释。`
      }
    ]);
  } catch {
    return buildRiskExplanationFallback(risk);
  }
}

function scoreRiskAgainstQuestion(risk: RiskHit, question: string) {
  const normalizedQuestion = normalizeForMatch(question);
  let score = 0;

  const titleTokens = risk.title.split(/[\/\s]+/).filter((item) => item.length >= 2);
  for (const token of titleTokens) {
    if (normalizedQuestion.includes(normalizeForMatch(token))) {
      score += 8;
    }
  }

  for (const keyword of risk.matchedKeywords) {
    if (normalizedQuestion.includes(normalizeForMatch(keyword))) {
      score += 5;
    }
  }

  if (normalizedQuestion.includes(normalizeForMatch(risk.riskCode))) {
    score += 10;
  }

  if (normalizedQuestion.includes(normalizeForMatch(risk.category))) {
    score += 4;
  }

  for (const evidence of risk.evidence) {
    if (
      normalizedQuestion.includes(normalizeForMatch(evidence.fileName)) ||
      normalizedQuestion.includes(normalizeForMatch(evidence.summary))
    ) {
      score += 2;
    }
  }

  return score;
}

function buildChatCitations(risks: RiskHit[]): ProjectChatCitation[] {
  return risks.flatMap((risk) =>
    risk.evidence.slice(0, 3).map((evidence) => ({
      riskId: risk.id,
      riskCode: risk.riskCode,
      riskTitle: risk.title,
      fileName: evidence.fileName,
      summary: evidence.summary,
      severity: risk.severity,
      score: risk.score
    }))
  );
}

function buildSuggestedQuestions(project: ProjectData, risks: RiskHit[]) {
  if (risks.length === 0) {
    return [
      "请总结当前项目的主要高风险点。",
      "为了提高判断质量，下一步最需要补哪些资料？",
      "当前项目最值得优先执行的审计程序有哪些？"
    ];
  }

  const firstRisk = risks[0];
  return unique([
    "该风险最关键的证据是什么？",
    `系统建议如何验证“${firstRisk.title}”？`,
    "如果补充资料，优先补哪些文件最有效？"
  ]).slice(0, 3);
}

function selectRelevantRisks(project: ProjectData, question: string) {
  const scored = project.risks
    .map((risk) => ({
      risk,
      score: scoreRiskAgainstQuestion(risk, question)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return b.risk.score - a.risk.score;
    });

  const positive = scored
    .filter((item) => item.score > 0)
    .slice(0, 3)
    .map((item) => item.risk);
  if (positive.length > 0) {
    return positive;
  }

  if (/(总结|概览|整体|重点|主要|高风险|概况)/.test(question)) {
    return [...project.risks].sort((a, b) => b.score - a.score).slice(0, 3);
  }

  return [...project.risks].sort((a, b) => b.score - a.score).slice(0, 1);
}

function buildRetrievals(
  risks: RiskHit[],
  vectorHits: Awaited<ReturnType<typeof searchProjectVectors>>
) {
  const riskRetrievals: ProjectChatRetrievalItem[] = risks.map((risk) => ({
    id: `${risk.id}_rule`,
    type: "rule",
    title: `${risk.title} · 规则匹配`,
    detail: `命中 ${risk.matchedKeywords.length} 个关键词、${risk.financialSignals.length} 个财务信号，当前风险评分 ${risk.score}。`,
    riskCode: risk.riskCode,
    score: risk.score
  }));

  const vectorRetrievals: ProjectChatRetrievalItem[] = vectorHits.map((item, index) => ({
    id: `${item.recordId}_${index}`,
    type: "vector",
    title: `${item.fileName} · 向量检索`,
    detail: item.content,
    fileName: item.fileName,
    score: Number(item.score.toFixed(3))
  }));

  return [...riskRetrievals, ...vectorRetrievals];
}

function buildChatFallback(project: ProjectData, question: string): ProjectChatReply {
  const relatedRisks = selectRelevantRisks(project, question);
  const citations = buildChatCitations(relatedRisks).slice(0, 4);
  const retrievals = buildRetrievals(relatedRisks, []);

  if (relatedRisks.length === 0 || citations.length === 0) {
    return {
      content:
        "当前资料不足，无法判断。现有风险结果中没有足以直接回答该问题的证据，建议补充更具体的问题或更多底层资料。",
      meta: {
        confidence: "low",
        insufficient: true,
        answeredBy: "fallback",
        relatedRiskCodes: [],
        citations: [],
        suggestedQuestions: buildSuggestedQuestions(project, []),
        retrievals,
        feedback: null
      }
    };
  }

  const leadRisk = relatedRisks[0];
  return {
    content: `${leadRisk.title} 当前判断为 ${leadRisk.severity} 风险，评分 ${leadRisk.score}。主要依据包括：${citations
      .slice(0, 3)
      .map((item) => `${item.fileName} 中的${item.summary}`)
      .join("；")}。建议优先执行：${leadRisk.auditProcedures[0]}`,
    meta: {
      confidence: citations.length >= 3 ? "high" : "medium",
      insufficient: false,
      answeredBy: "fallback",
      relatedRiskCodes: relatedRisks.map((item) => item.riskCode),
      citations,
      suggestedQuestions: buildSuggestedQuestions(project, relatedRisks),
      retrievals,
      feedback: null
    }
  };
}

export async function answerProjectQuestion(project: ProjectData, question: string) {
  const relatedRisks = selectRelevantRisks(project, question);
  const citations = buildChatCitations(relatedRisks).slice(0, 5);
  const suggestedQuestions = buildSuggestedQuestions(project, relatedRisks);
  const vectorHits = await searchProjectVectors(project, question);
  const retrievals = buildRetrievals(relatedRisks, vectorHits);

  if (relatedRisks.length === 0 || citations.length === 0) {
    return buildChatFallback(project, question);
  }

  const context = relatedRisks
    .map(
      (risk) =>
        `${risk.title}(${risk.riskCode})，评分 ${risk.score}，证据：${risk.evidence
          .slice(0, 3)
          .map((item) => `${item.fileName}:${item.summary}`)
          .join("；")}，建议程序：${risk.auditProcedures.slice(0, 2).join("；")}`
    )
    .join("\n");

  const retrievalContext = vectorHits
    .map((item) => `${item.fileName}：${item.content}`)
    .join("\n");

  try {
    const content = await callQwen([
      {
        role: "system",
        content:
          "你是零售行业审计答辩助手。必须严格只根据提供的风险结果作答；不能虚构事实；若证据不足，明确写“当前资料不足，无法判断”。回答控制在220字以内，优先写结论、依据、建议。结尾必须加“依据：...”并点名文件或风险编码。"
      },
      {
        role: "user",
        content: `项目：${project.companyName} ${project.year}
问题：${question}
已筛选相关风险：
${context}
补充向量检索片段：
${retrievalContext || "无"}`
      }
    ]);

    return {
      content,
      meta: {
        confidence: citations.length >= 3 ? "high" : "medium",
        insufficient: false,
        answeredBy: "ai",
        relatedRiskCodes: relatedRisks.map((item) => item.riskCode),
        citations,
        suggestedQuestions,
        retrievals,
        feedback: null
      }
    } satisfies ProjectChatReply;
  } catch {
    return buildChatFallback(project, question);
  }
}
