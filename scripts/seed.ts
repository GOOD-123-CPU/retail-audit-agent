import fs from "node:fs/promises";
import path from "node:path";

import { runProjectAnalysis } from "../lib/analysis";
import { ensureSystemUsers } from "../lib/bootstrap";
import { env } from "../lib/env";
import { ensureDirectories, projectsDir, samplesDir, storageDir, writeJsonFile } from "../lib/fs";
import { parseFileBuffer } from "../lib/parsers";
import { ProjectCategory, ProjectData } from "../lib/types";
import { createId, nowIso, sanitizeFileName } from "../lib/utils";

const demoProjectId = "project_demo_retail_2025";

async function buildRecord(projectId: string, fileName: string, category: ProjectCategory) {
  const sourcePath = path.join(samplesDir, fileName);
  const targetDir = path.join(storageDir, projectId);
  const targetPath = path.join(targetDir, `${Date.now()}-${sanitizeFileName(fileName)}`);
  const buffer = await fs.readFile(sourcePath);

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetPath, buffer);

  const parsed = await parseFileBuffer({
    buffer,
    fileName,
    mimeType: fileName.endsWith(".csv") ? "text/csv" : "text/plain",
    category
  });

  return {
    id: createId("record"),
    category,
    fileName,
    mimeType: fileName.endsWith(".csv") ? "text/csv" : "text/plain",
    size: buffer.byteLength,
    uploadedAt: nowIso(),
    storedPath: targetPath,
    ...parsed
  };
}

async function main() {
  await ensureDirectories();
  const users = await ensureSystemUsers();
  const companyUser =
    users.find((user) => user.email === env.defaultCompanyUserEmail.toLowerCase()) ??
    users.find((user) => user.role === "user");

  if (!companyUser) {
    throw new Error("未找到企业用户账号，无法初始化示例项目。");
  }

  const project: ProjectData = {
    id: demoProjectId,
    name: "2025 年零售经营审计示范项目",
    companyName: "示例商业集团有限公司",
    year: "2025",
    industry: "零售业",
    ownerId: companyUser.id,
    status: "draft",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    summary: "演示项目已初始化。",
    records: [
      await buildRecord(demoProjectId, "financial_overview.csv", "financials"),
      await buildRecord(demoProjectId, "revenue_exception_memo.txt", "operations"),
      await buildRecord(demoProjectId, "store_expansion_note.txt", "operations"),
      await buildRecord(demoProjectId, "inventory_ageing_report.txt", "operations"),
      await buildRecord(demoProjectId, "rebate_settlement_invoice.txt", "documents"),
      await buildRecord(demoProjectId, "rebate_framework_agreement.txt", "contracts")
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

  const analyzed = await runProjectAnalysis(project);
  await writeJsonFile(path.join(projectsDir, `${demoProjectId}.json`), analyzed);

  console.log("Seed completed");
  console.log(`Admin: ${env.defaultAdminEmail}`);
  console.log(`Company User: ${env.defaultCompanyUserEmail}`);
  console.log(`Project Owner: ${companyUser.email}`);
  console.log(`Project: ${analyzed.name}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
