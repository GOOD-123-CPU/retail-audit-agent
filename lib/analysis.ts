import { answerProjectQuestion, explainRisk } from "@/lib/ai";
import { buildReportMarkdown } from "@/lib/report";
import { getActiveRules } from "@/lib/rule-configs";
import { analyzeProjectRules } from "@/lib/rules";
import { ProjectChatMessage, ProjectData } from "@/lib/types";
import { createId, nowIso } from "@/lib/utils";
import { generateWorkpapers } from "@/lib/workpapers";

/** AI 解释调用的并发上限，避免同时打满上游配额或触发限流。 */
const EXPLAIN_CONCURRENCY = 3;

/**
 * 受限并发地为数组每一项执行异步任务（保持结果顺序）。
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function runProjectAnalysis(project: ProjectData) {
  const activeRules = await getActiveRules();
  const { metrics, risks } = analyzeProjectRules(project, activeRules);
  const aiExplanations = await mapWithConcurrency(
    risks,
    EXPLAIN_CONCURRENCY,
    (risk) => explainRisk(risk, project)
  );
  const enrichedRisks = risks.map((risk, index) => ({
    ...risk,
    aiExplanation: aiExplanations[index]
  }));

  const summary =
    enrichedRisks.length === 0
      ? "当前资料尚未识别到达到阈值的重大风险，但仍建议补充更多经营与票据资料后复核。"
      : `共识别 ${enrichedRisks.length} 项风险，其中高风险 ${
          enrichedRisks.filter((risk) => risk.severity === "high").length
        } 项。重点关注 ${enrichedRisks
          .slice(0, 2)
          .map((risk) => risk.title)
          .join("、")}。`;

  const nextProject: ProjectData = {
    ...project,
    status: "analyzed",
    summary,
    metrics,
    risks: enrichedRisks,
    reportMarkdown: "",
    updatedAt: nowIso()
  };

  nextProject.reportMarkdown = buildReportMarkdown(nextProject);
  await generateWorkpapers(nextProject);
  return nextProject;
}

export async function appendProjectChat(project: ProjectData, question: string) {
  const reply = await answerProjectQuestion(project, question);
  const timestamp = nowIso();

  const newMessages: ProjectChatMessage[] = [
    {
      id: createId("chat"),
      role: "user",
      content: question,
      createdAt: timestamp
    },
    {
      id: createId("chat"),
      role: "assistant",
      content: reply.content,
      meta: reply.meta,
      createdAt: timestamp
    }
  ];

  return {
    ...project,
    conversation: [...project.conversation, ...newMessages].slice(-40),
    updatedAt: timestamp
  };
}

export function updateProjectChatFeedback(
  project: ProjectData,
  messageId: string,
  feedback: "up" | "down" | null
) {
  let updated = false;

  const conversation: ProjectChatMessage[] = project.conversation.map((message) => {
    if (message.id !== messageId || message.role !== "assistant" || !message.meta) {
      return message;
    }

    updated = true;
    return {
      ...message,
      meta: {
        ...message.meta,
        feedback
      }
    };
  });

  if (!updated) {
    throw new Error("未找到可反馈的问答消息。");
  }

  return {
    ...project,
    conversation,
    updatedAt: nowIso()
  };
}

export function clearProjectChat(project: ProjectData) {
  return {
    ...project,
    conversation: [],
    updatedAt: nowIso()
  };
}
