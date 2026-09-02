import { describe, expect, it, vi, beforeEach } from "vitest";

// AI 层外部依赖 mock：验证编排逻辑与降级路径，不真正发起网络请求。
vi.mock("@/lib/ai", () => ({
  answerProjectQuestion: vi.fn(),
  explainRisk: vi.fn()
}));
vi.mock("@/lib/rule-configs", () => ({
  getActiveRules: vi.fn()
}));

import { runProjectAnalysis, appendProjectChat, clearProjectChat } from "@/lib/analysis";
import { explainRisk, answerProjectQuestion } from "@/lib/ai";
import { getActiveRules } from "@/lib/rule-configs";
import { analyzeProjectRules, RULES } from "@/lib/rules";
import { buildReportMarkdown } from "@/lib/report";
import { ProjectData } from "@/lib/types";
import { createId, nowIso } from "@/lib/utils";

const mockedExplain = vi.mocked(explainRisk);
const mockedGetRules = vi.mocked(getActiveRules);

function makeProject(): ProjectData {
  return {
    id: createId("project"),
    name: "编排测试项目",
    companyName: "示例商业集团有限公司",
    year: "2025",
    industry: "零售业",
    ownerId: "user_test",
    status: "draft",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    summary: "",
    records: [
      {
        id: createId("record"),
        category: "operations",
        fileName: "memo.txt",
        mimeType: "text/plain",
        size: 100,
        uploadedAt: nowIso(),
        storedPath: "storage/memo.txt",
        parser: "text",
        text: "存在刷单与冲量行为，并配合补单、渠道压货，还有异常退货和提前确认收入。",
        structuredRows: [],
        extractedFields: [],
        encodingFixed: false
      }
    ],
    risks: [],
    metrics: {
      revenueGrowthRate: 0,
      returnRate: 0,
      receivableGrowthRate: 0,
      inventoryGrowthRate: 0,
      inventoryTurnoverDays: 0,
      grossMargin: 0,
      grossMarginTrend: 0,
      storeGrowthRate: 0,
      revenuePerStoreGrowthRate: 0,
      rebateExpenseRate: 0,
      marketingExpenseRate: 0,
      totalExpenseRate: 0,
      receivableTurnoverDays: 0,
      signals: [],
      notes: []
    },
    reportMarkdown: "",
    conversation: []
  };
}

describe("analysis 编排", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetRules.mockResolvedValue(RULES);
  });

  it("分析后项目状态更新、风险带 AI 解释、报告与底稿生成", async () => {
    mockedExplain.mockResolvedValue("AI 解释内容");

    const result = await runProjectAnalysis(makeProject());

    expect(result.status).toBe("analyzed");
    expect(result.risks.length).toBeGreaterThan(0);
    expect(result.risks.every((risk) => risk.aiExplanation === "AI 解释内容")).toBe(true);
    expect(result.summary).toContain("共识别");
    expect(result.reportMarkdown.length).toBeGreaterThan(100);
  });

  it("无风险时摘要走兜底文案", async () => {
    const { analyzeProjectRules: noopRules } = await import("@/lib/rules");
    mockedGetRules.mockResolvedValue([
      { ...RULES[0], triggerKeywords: ["绝不存在的触发词XYZ"], financialSignals: [] }
    ]);

    const result = await runProjectAnalysis(makeProject());
    expect(result.risks).toHaveLength(0);
    expect(result.summary).toContain("尚未识别");
  });
});

describe("report 报告生成", () => {
  it("报告包含公司名、风险统计与审计程序", () => {
    const project = makeProject();
    const { risks } = analyzeProjectRules(project, RULES);
    project.risks = risks;
    const report = buildReportMarkdown(project);

    expect(report).toContain(project.companyName);
    expect(report).toContain("刷单");
  });
});

describe("chat 会话管理", () => {
  it("appendProjectChat 追加问答对并限制会话长度", async () => {
    vi.mocked(answerProjectQuestion).mockResolvedValue({
      content: "回答内容",
      meta: {
        confidence: "high",
        insufficient: false,
        answeredBy: "fallback",
        relatedRiskCodes: [],
        citations: [],
        suggestedQuestions: [],
        retrievals: [],
        feedback: null
      }
    });

    let project = makeProject();
    for (let i = 0; i < 25; i += 1) {
      project = await appendProjectChat(project, `问题 ${i}`);
    }

    // 上限 40 条（25 轮 = 50 条，被截断）
    expect(project.conversation.length).toBe(40);
    expect(project.conversation[0].content).not.toBe("问题 0");
  });

  it("clearProjectChat 清空会话", async () => {
    vi.mocked(answerProjectQuestion).mockResolvedValue({
      content: "回答",
      meta: {
        confidence: "low",
        insufficient: true,
        answeredBy: "fallback",
        relatedRiskCodes: [],
        citations: [],
        suggestedQuestions: [],
        retrievals: [],
        feedback: null
      }
    });

    let project = await appendProjectChat(makeProject(), "问题");
    expect(project.conversation).toHaveLength(2);
    project = clearProjectChat(project);
    expect(project.conversation).toHaveLength(0);
  });
});
