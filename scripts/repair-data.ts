import fs from "node:fs/promises";
import path from "node:path";

import { cleanOptionalText, cleanText } from "../lib/cleaners";
import {
  approvalsFile,
  projectsDir,
  readJsonFile,
  usersFile,
  workpapersDir,
  writeJsonFile
} from "../lib/fs";
import { normalizeProjectData } from "../lib/projects";
import { UserRecord } from "../lib/types";

async function repairUsers() {
  const users = await readJsonFile<UserRecord[]>(usersFile, []);
  const repaired = users.map((user) => ({
    ...user,
    name: cleanText(user.name, { maxLength: 80 }),
    email: cleanText(user.email, { maxLength: 120 })
  }));

  if (JSON.stringify(users) !== JSON.stringify(repaired)) {
    await writeJsonFile(usersFile, repaired);
  }
}

async function repairProjects() {
  const files = await fs.readdir(projectsDir).catch(() => []);

  for (const file of files) {
    const fullPath = path.join(projectsDir, file);
    const project = await readJsonFile(fullPath, null);
    if (!project) {
      continue;
    }

    const { normalized } = normalizeProjectData(project);
    await writeJsonFile(fullPath, normalized);
  }
}

async function repairApprovals() {
  const approvals = await readJsonFile<any[]>(approvalsFile, []);
  const repaired = approvals.map((item) => ({
    ...item,
    currentStep: cleanText(item.currentStep, { maxLength: 64, preserveNewlines: false }),
    comment: cleanOptionalText(item.comment, { maxLength: 200 }),
    history: Array.isArray(item.history)
      ? item.history.map((historyItem: any) => ({
          ...historyItem,
          actorName: cleanText(historyItem.actorName, { maxLength: 80 }),
          comment: cleanOptionalText(historyItem.comment, { maxLength: 200 })
        }))
      : []
  }));

  if (JSON.stringify(approvals) !== JSON.stringify(repaired)) {
    await writeJsonFile(approvalsFile, repaired);
  }
}

async function repairWorkpapers() {
  const files = await fs.readdir(workpapersDir).catch(() => []);

  for (const file of files) {
    const fullPath = path.join(workpapersDir, file);
    const workpapers = await readJsonFile<any[]>(fullPath, []);
    const repaired = workpapers.map((item) => ({
      ...item,
      title: cleanText(item.title, { maxLength: 160 }),
      generatedMarkdown: cleanText(item.generatedMarkdown, { maxLength: 20000 })
    }));

    if (JSON.stringify(workpapers) !== JSON.stringify(repaired)) {
      await writeJsonFile(fullPath, repaired);
    }
  }
}

async function main() {
  await repairUsers();
  await repairProjects();
  await repairApprovals();
  await repairWorkpapers();
  console.log("Repair completed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
