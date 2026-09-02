import { ProjectData } from "@/lib/types";
import { formatPercent } from "@/lib/utils";

export function buildReportMarkdown(project: ProjectData) {
  const overview = [
    `- 项目名称：${project.name}`,
    `- 被审计单位：${project.companyName}`,
    `- 年度：${project.year}`,
    `- 行业：${project.industry}`,
    `- 资料数量：${project.records.length}`,
    `- 风险数量：${project.risks.length}`
  ].join("\n");

  const metricSection = [
    `- 营收同比增幅：${formatPercent(project.metrics.revenueGrowthRate)}`,
    `- 退货率：${formatPercent(project.metrics.returnRate)}`,
    `- 应收同比增幅：${formatPercent(project.metrics.receivableGrowthRate)}`,
    `- 存货同比增幅：${formatPercent(project.metrics.inventoryGrowthRate)}`,
    `- 平均周转天数：${project.metrics.inventoryTurnoverDays.toFixed(0)} 天`,
    `- 平均毛利率：${formatPercent(project.metrics.grossMargin)}`,
    `- 门店增长率：${formatPercent(project.metrics.storeGrowthRate)}`,
    `- 单店收入增长率：${formatPercent(project.metrics.revenuePerStoreGrowthRate)}`,
    `- 返利费用率：${formatPercent(project.metrics.rebateExpenseRate)}`,
    `- 市场费用率：${formatPercent(project.metrics.marketingExpenseRate)}`
  ].join("\n");

  const risks = project.risks
    .map(
      (risk, index) => `## ${index + 1}. ${risk.title}

- 风险编码：${risk.riskCode}
- 风险等级：${risk.severity}
- 风险评分：${risk.score}
- 风险摘要：${risk.summary}
- 命中关键词：${risk.matchedKeywords.join("、") || "无"}
- 财务信号：${risk.financialSignals.join("、") || "无"}
- 审计准则提示：${risk.auditStandard}

### 证据链
${risk.evidence.map((item) => `- ${item.fileName}：${item.summary}`).join("\n")}

### 验证逻辑
${risk.validationLogic.map((item) => `- ${item}`).join("\n")}

### 建议审计程序
${risk.auditProcedures.map((item) => `- ${item}`).join("\n")}

### AI 解释
${risk.aiExplanation || "AI 解释暂不可用。"}
`
    )
    .join("\n");

  const sources = project.records
    .map((record) => `- ${record.fileName}：${record.category} / ${record.parser}`)
    .join("\n");

  return `# 零售业 AI 审计报告

## 项目概览
${overview}

## 风险总览
${project.summary}

## 关键指标
${metricSection}

## 风险明细
${risks || "当前未识别到达到阈值的风险。"}

## 数据来源
${sources}

## 结论
本报告基于系统内置规则引擎自动生成，所有风险结论均可追溯至数据源、规则命中结果与建议审计程序，可用于项目汇报、答辩展示和后续深度复核。`;
}
