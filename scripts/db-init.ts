import { initializeDatabaseSchema, closeDatabasePool } from "../lib/db";
import {
  ensureRuleConfigsInDatabase,
  writeProjectToDatabase,
  writeUsersToDatabase
} from "../lib/database-store";
import { ensureDefaultWorkpaperTemplates } from "../lib/workpapers";
import { ensureDirectories, listProjectFiles, projectsDir, readJsonFile, usersFile } from "../lib/fs";
import { normalizeProjectData } from "../lib/projects";
import { ProjectData, UserRecord } from "../lib/types";
import path from "node:path";

async function main() {
  await ensureDirectories();
  await initializeDatabaseSchema();

  const users = await readJsonFile<UserRecord[]>(usersFile, []);
  await writeUsersToDatabase(users);

  const files = await listProjectFiles();
  for (const file of files) {
    const project = await readJsonFile<ProjectData | null>(path.join(projectsDir, file), null);
    if (!project) {
      continue;
    }

    const { normalized } = normalizeProjectData(project);
    await writeProjectToDatabase(normalized);
  }

  await ensureRuleConfigsInDatabase();
  await ensureDefaultWorkpaperTemplates();
  console.log("Database initialized and synchronized");
  await closeDatabasePool();
}

main().catch(async (error) => {
  console.error(error);
  await closeDatabasePool();
  process.exit(1);
});
