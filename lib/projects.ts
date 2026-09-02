import path from "node:path";

import { repairMojibake, shouldDropConversationMessage } from "@/lib/encoding";
import {
  listProjectItemsFromDatabase,
  readProjectByIdFromDatabase,
  readProjectsFromDatabase,
  writeProjectToDatabase
} from "@/lib/database-store";
import {
  ensureDirectories,
  listProjectFiles,
  projectsDir,
  readJsonFile,
  writeJsonFile
} from "@/lib/fs";
import { canReadProject, canWriteProject } from "@/lib/permissions";
import {
  ProjectChatMessage,
  ProjectData,
  ProjectListItem,
  ProjectMetricSnapshot,
  SessionUser
} from "@/lib/types";
import { buildReportMarkdown } from "@/lib/report";
import { rebuildProjectVectors } from "@/lib/vector-search";
import { createId, nowIso } from "@/lib/utils";

function emptyMetrics(): ProjectMetricSnapshot {
  return {
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
  };
}

export function projectFilePath(projectId: string) {
  return path.join(projectsDir, `${projectId}.json`);
}

function normalizeConversation(messages: ProjectChatMessage[]) {
  const normalized: ProjectChatMessage[] = [];

  for (const message of messages) {
    const content = repairMojibake(message.content).text;
    if (shouldDropConversationMessage(content)) {
      continue;
    }

    normalized.push({
      ...message,
      content,
      meta: message.meta
        ? {
            ...message.meta,
            citations: message.meta.citations.map((citation) => ({
              ...citation,
              riskTitle: repairMojibake(citation.riskTitle).text,
              fileName: repairMojibake(citation.fileName).text,
              summary: repairMojibake(citation.summary).text
            })),
            retrievals: (message.meta.retrievals ?? []).map((item) => ({
              ...item,
              title: repairMojibake(item.title).text,
              detail: repairMojibake(item.detail).text,
              fileName: item.fileName ? repairMojibake(item.fileName).text : undefined,
              riskCode: item.riskCode ? repairMojibake(item.riskCode).text : undefined
            })),
            suggestedQuestions: message.meta.suggestedQuestions
              .map((item) => repairMojibake(item).text)
              .filter(Boolean),
            feedback: message.meta.feedback ?? null
          }
        : undefined
    });
  }

  return normalized.slice(-40);
}

export function normalizeProjectData(project: ProjectData) {
  const normalized: ProjectData = {
    ...project,
    name: repairMojibake(project.name).text,
    companyName: repairMojibake(project.companyName).text,
    year: repairMojibake(project.year).text,
    industry: repairMojibake(project.industry).text,
    summary: repairMojibake(project.summary).text,
    reportMarkdown: repairMojibake(project.reportMarkdown).text,
    records: project.records.map((record) => ({
      ...record,
      fileName: repairMojibake(record.fileName).text,
      text: repairMojibake(record.text).text,
      extractedFields: record.extractedFields.map((field) => ({
        ...field,
        name: repairMojibake(field.name).text,
        value: repairMojibake(field.value).text,
        sourceSnippet: repairMojibake(field.sourceSnippet).text
      }))
    })),
    risks: project.risks.map((risk) => ({
      ...risk,
      title: repairMojibake(risk.title).text,
      category: repairMojibake(risk.category).text,
      matchedKeywords: risk.matchedKeywords.map((item) => repairMojibake(item).text),
      financialSignals: risk.financialSignals.map((item) => repairMojibake(item).text),
      nonFinancialSignals: risk.nonFinancialSignals.map((item) => repairMojibake(item).text),
      validationLogic: risk.validationLogic.map((item) => repairMojibake(item).text),
      auditStandard: repairMojibake(risk.auditStandard).text,
      auditProcedures: risk.auditProcedures.map((item) => repairMojibake(item).text),
      summary: repairMojibake(risk.summary).text,
      aiExplanation: repairMojibake(risk.aiExplanation).text,
      evidence: risk.evidence.map((item) => ({
        ...item,
        fileName: repairMojibake(item.fileName).text,
        summary: repairMojibake(item.summary).text,
        sourceExcerpt: item.sourceExcerpt
          ? repairMojibake(item.sourceExcerpt).text
          : undefined
      }))
    })),
    metrics: {
      ...project.metrics,
      signals: project.metrics.signals.map((item) => repairMojibake(item).text),
      notes: project.metrics.notes.map((item) => repairMojibake(item).text)
    },
    conversation: normalizeConversation(project.conversation ?? [])
  };

  if (normalized.status === "analyzed" && normalized.risks.length > 0) {
    normalized.reportMarkdown = buildReportMarkdown(normalized);
  }

  const changed = JSON.stringify(project) !== JSON.stringify(normalized);
  return { normalized, changed };
}

export async function listProjectsForUser(user: SessionUser) {
  await ensureDirectories();
  const projects: ProjectListItem[] = [];

  const databaseItems = await listProjectItemsFromDatabase(
    user.role === "admin" ? undefined : user.id
  );
  if (databaseItems && databaseItems.length > 0) {
    return databaseItems.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const files = await listProjectFiles();

  for (const file of files) {
    const project = await getProjectById(path.basename(file, path.extname(file)));
    if (!project || !canReadProject(user, project)) {
      continue;
    }

    projects.push({
      id: project.id,
      name: project.name,
      companyName: project.companyName,
      year: project.year,
      industry: project.industry,
      ownerId: project.ownerId,
      updatedAt: project.updatedAt,
      status: project.status,
      riskCount: project.risks.length,
      highRiskCount: project.risks.filter((risk) => risk.severity === "high").length
    });
  }

  return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createProject(params: {
  name: string;
  companyName: string;
  year: string;
  industry: string;
  ownerId: string;
}) {
  const timestamp = nowIso();
  const project: ProjectData = {
    id: createId("project"),
    name: params.name,
    companyName: params.companyName,
    year: params.year,
    industry: params.industry,
    ownerId: params.ownerId,
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
    summary: "项目已创建，等待上传资料并执行风险扫描。",
    records: [],
    risks: [],
    metrics: emptyMetrics(),
    reportMarkdown: "",
    conversation: []
  };

  return saveProject(project);
}

export async function getProjectById(projectId: string) {
  const databaseProject = await readProjectByIdFromDatabase(projectId);
  const project = databaseProject
    ? databaseProject
    : await readJsonFile<ProjectData | null>(projectFilePath(projectId), null);
  if (!project) {
    return null;
  }

  const { normalized, changed } = normalizeProjectData(project);
  if (changed) {
    await writeProjectToDatabase(normalized);
    await writeJsonFile(projectFilePath(projectId), normalized);
  }

  return normalized;
}

export async function getReadableProjectForUser(projectId: string, user: SessionUser) {
  const project = await getProjectById(projectId);
  if (!project || !canReadProject(user, project)) {
    return null;
  }

  return project;
}

export async function getWritableProjectForUser(projectId: string, user: SessionUser) {
  const project = await getProjectById(projectId);
  if (!project || !canWriteProject(user, project)) {
    return null;
  }

  return project;
}

export async function saveProject(project: ProjectData) {
  const { normalized } = normalizeProjectData({
    ...project,
    updatedAt: nowIso()
  });

  const wroteToDatabase = await writeProjectToDatabase(normalized);
  if (wroteToDatabase) {
    await rebuildProjectVectors(normalized);
  }
  await writeJsonFile(projectFilePath(project.id), normalized);
  return normalized;
}
