import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

export const dataDir = path.join(root, "data");
export const projectsDir = path.join(dataDir, "projects");
export const usersFile = path.join(dataDir, "users.json");
export const ruleConfigsFile = path.join(dataDir, "rule-configs.json");
export const approvalsFile = path.join(dataDir, "approval-requests.json");
export const workpapersDir = path.join(dataDir, "workpapers");
export const storageDir = path.join(root, "storage");
export const samplesDir = path.join(root, "samples");

export async function ensureDirectories() {
  await fs.mkdir(projectsDir, { recursive: true });
  await fs.mkdir(workpapersDir, { recursive: true });
  await fs.mkdir(storageDir, { recursive: true });
  await fs.mkdir(samplesDir, { recursive: true });

  for (const filePath of [usersFile, ruleConfigsFile, approvalsFile]) {
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, "[]", "utf8");
    }
  }
}

export async function readJsonFile<T>(filePath: string, fallback: T) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function listProjectFiles() {
  try {
    return await fs.readdir(projectsDir);
  } catch {
    return [];
  }
}

export function workpapersFile(projectId: string) {
  return path.join(workpapersDir, `${projectId}.json`);
}
