import crypto from "node:crypto";

import { cleanText } from "@/lib/cleaners";
import { executeStatement, isDatabaseEnabled, queryRows } from "@/lib/db";
import {
  ensureDirectories,
  readJsonFile,
  workpapersFile,
  writeJsonFile
} from "@/lib/fs";
import { ProjectData } from "@/lib/types";
import { nowIso } from "@/lib/utils";

export type WorkpaperTemplate = {
  id: string;
  code: string;
  name: string;
  description: string;
  scopeType: "project" | "risk";
  templateMarkdown: string;
  isDefault: boolean;
};

export type Workpaper = {
  id: string;
  projectId: string;
  templateId: string;
  title: string;
  status: "draft" | "issued";
  generatedMarkdown: string;
  createdAt: string;
  updatedAt: string;
};

type WorkpaperTemplateRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  scope_type: "project" | "risk";
  template_markdown: string;
  is_default: number;
  created_at: string;
  updated_at: string;
};

type WorkpaperRow = {
  id: string;
  project_id: string;
  template_id: string;
  title: string;
  status: "draft" | "issued";
  generated_markdown: string;
  created_at: string;
  updated_at: string;
};

export const defaultWorkpaperTemplates: WorkpaperTemplate[] = [
  {
    id: "tpl_project_summary",
    code: "project_summary",
    name: "项目总体底稿",
    description: "汇总项目背景、指标概览、主要风险与建议程序。",
    scopeType: "project",
    templateMarkdown: `# 项目总体底稿

## 项目背景
- 项目名称：{{projectName}}
- 被审计单位：{{companyName}}
- 年度：{{year}}
- 行业：{{industry}}

## 指标概览
{{metricLines}}

## 重点风险
{{riskLines}}

## 建议下一步
{{procedureLines}}
`,
    isDefault: true
  },
  {
    id: "tpl_risk_validation",
    code: "risk_validation",
    name: "风险验证底稿",
    description: "针对单个高风险生成验证逻辑与证据链底稿。",
    scopeType: "risk",
    templateMarkdown: `# 风险验证底稿

## 风险信息
- 风险名称：{{riskTitle}}
- 风险编码：{{riskCode}}
- 风险等级：{{severity}}
- 风险评分：{{score}}

## 风险摘要
{{summary}}

## 证据链
{{evidenceLines}}

## 建议审计程序
{{procedureLines}}
`,
    isDefault: true
  }
];

function normalizeWorkpaper(workpaper: Workpaper): Workpaper {
  return {
    ...workpaper,
    title: cleanText(workpaper.title, { maxLength: 160 }),
    generatedMarkdown: cleanText(workpaper.generatedMarkdown, { maxLength: 20000 })
  };
}

function mapWorkpaperRow(row: WorkpaperRow): Workpaper {
  return normalizeWorkpaper({
    id: row.id,
    projectId: row.project_id,
    templateId: row.template_id,
    title: row.title,
    status: row.status,
    generatedMarkdown: row.generated_markdown,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  });
}

async function readWorkpapersFromFile(projectId: string) {
  await ensureDirectories();
  const workpapers = await readJsonFile<Workpaper[]>(workpapersFile(projectId), []);
  return workpapers.map(normalizeWorkpaper);
}

async function writeWorkpapersToFile(projectId: string, workpapers: Workpaper[]) {
  await writeJsonFile(
    workpapersFile(projectId),
    workpapers.map(normalizeWorkpaper).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  );
}

async function persistWorkpapersToDatabase(projectId: string, workpapers: Workpaper[]) {
  if (!isDatabaseEnabled()) {
    return false;
  }

  try {
    await executeStatement("DELETE FROM workpapers WHERE project_id = ?", [projectId]);
    for (const workpaper of workpapers) {
      await executeStatement(
        `INSERT INTO workpapers (
          id, project_id, template_id, title, status, generated_markdown, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          workpaper.id,
          workpaper.projectId,
          workpaper.templateId,
          workpaper.title,
          workpaper.status,
          workpaper.generatedMarkdown,
          workpaper.createdAt.slice(0, 19).replace("T", " "),
          workpaper.updatedAt.slice(0, 19).replace("T", " ")
        ]
      );
    }
    return true;
  } catch {
    return false;
  }
}

export async function ensureDefaultWorkpaperTemplates() {
  if (!isDatabaseEnabled()) {
    return;
  }

  try {
    for (const template of defaultWorkpaperTemplates) {
      await executeStatement(
        `INSERT INTO workpaper_templates (
          id, code, name, description, scope_type, template_markdown, is_default, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          description = VALUES(description),
          scope_type = VALUES(scope_type),
          template_markdown = VALUES(template_markdown),
          is_default = VALUES(is_default),
          updated_at = NOW()`,
        [
          template.id,
          template.code,
          template.name,
          template.description,
          template.scopeType,
          template.templateMarkdown,
          template.isDefault ? 1 : 0
        ]
      );
    }
  } catch {
    return;
  }
}

export async function listWorkpaperTemplates() {
  if (!isDatabaseEnabled()) {
    return defaultWorkpaperTemplates;
  }

  try {
    const rows = await queryRows<WorkpaperTemplateRow[]>(
      "SELECT * FROM workpaper_templates ORDER BY code ASC"
    );

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: cleanText(row.name, { maxLength: 120 }),
      description: cleanText(row.description, { maxLength: 240 }),
      scopeType: row.scope_type,
      templateMarkdown: cleanText(row.template_markdown, { maxLength: 12000 }),
      isDefault: row.is_default === 1
    }));
  } catch {
    return defaultWorkpaperTemplates;
  }
}

export async function listWorkpapers(projectId: string) {
  if (isDatabaseEnabled()) {
    try {
      const rows = await queryRows<WorkpaperRow[]>(
        "SELECT * FROM workpapers WHERE project_id = ? ORDER BY updated_at DESC",
        [projectId]
      );

      if (rows.length > 0) {
        return rows.map(mapWorkpaperRow);
      }
    } catch {
      // Fall back to the file store below.
    }
  }

  const workpapers = await readWorkpapersFromFile(projectId);
  if (workpapers.length > 0) {
    await persistWorkpapersToDatabase(projectId, workpapers);
  }
  return workpapers;
}

function renderTemplate(template: WorkpaperTemplate, project: ProjectData, riskId?: string) {
  const risk = riskId ? project.risks.find((item) => item.id === riskId) : undefined;

  const metricLines = [
    `- 营收同比增幅：${(project.metrics.revenueGrowthRate * 100).toFixed(1)}%`,
    `- 退货率：${(project.metrics.returnRate * 100).toFixed(1)}%`,
    `- 存货同比增幅：${(project.metrics.inventoryGrowthRate * 100).toFixed(1)}%`,
    `- 毛利率：${(project.metrics.grossMargin * 100).toFixed(1)}%`
  ].join("\n");

  const riskLines = project.risks
    .slice(0, 5)
    .map((item) => `- ${item.title}：${item.severity} / ${item.score}`)
    .join("\n");

  const procedureLines = (
    risk ? risk.auditProcedures : project.risks.flatMap((item) => item.auditProcedures)
  )
    .slice(0, 5)
    .map((item) => `- ${item}`)
    .join("\n");

  const evidenceLines = (risk?.evidence ?? [])
    .map((item) => `- ${item.fileName}：${item.summary}`)
    .join("\n");

  return template.templateMarkdown
    .replaceAll("{{projectName}}", project.name)
    .replaceAll("{{companyName}}", project.companyName)
    .replaceAll("{{year}}", project.year)
    .replaceAll("{{industry}}", project.industry)
    .replaceAll("{{metricLines}}", metricLines)
    .replaceAll("{{riskLines}}", riskLines)
    .replaceAll("{{procedureLines}}", procedureLines)
    .replaceAll("{{riskTitle}}", risk?.title ?? "未指定")
    .replaceAll("{{riskCode}}", risk?.riskCode ?? "未指定")
    .replaceAll("{{severity}}", risk?.severity ?? "未指定")
    .replaceAll("{{score}}", String(risk?.score ?? 0))
    .replaceAll("{{summary}}", risk?.summary ?? project.summary)
    .replaceAll("{{evidenceLines}}", evidenceLines || "- 暂无直接证据");
}

export async function generateWorkpapers(project: ProjectData) {
  const templates = await listWorkpaperTemplates();
  const generated: Workpaper[] = [];

  for (const template of templates) {
    if (template.scopeType === "project") {
      generated.push({
        id: crypto.randomUUID(),
        projectId: project.id,
        templateId: template.id,
        title: `${project.name} - ${template.name}`,
        status: "draft",
        generatedMarkdown: renderTemplate(template, project),
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
      continue;
    }

    for (const risk of project.risks.slice(0, 5)) {
      generated.push({
        id: crypto.randomUUID(),
        projectId: project.id,
        templateId: template.id,
        title: `${risk.title} - ${template.name}`,
        status: "draft",
        generatedMarkdown: renderTemplate(template, project, risk.id),
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
    }
  }

  const normalized = generated.map(normalizeWorkpaper);
  await persistWorkpapersToDatabase(project.id, normalized);
  await writeWorkpapersToFile(project.id, normalized);
  return normalized;
}
