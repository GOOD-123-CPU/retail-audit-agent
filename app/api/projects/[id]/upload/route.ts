import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { storageDir } from "@/lib/fs";
import { assertTrustedMutationRequest, badRequest, ok } from "@/lib/http";
import { parseFileBuffer } from "@/lib/parsers";
import { getWritableProjectForUser, saveProject } from "@/lib/projects";
import { assertRateLimit } from "@/lib/rate-limit";
import { createId, nowIso, sanitizeFileName } from "@/lib/utils";
import { sanitizeProjectCategory } from "@/lib/validation";

const allowedExtensions = new Set([
  ".xlsx",
  ".xls",
  ".csv",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".bmp",
  ".webp",
  ".txt",
  ".md"
]);

const maxFileCount = 5;
const maxFileBytes = 15 * 1024 * 1024;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return badRequest("请先登录。", 401);
    }

    assertTrustedMutationRequest(request);
    assertRateLimit(request, {
      action: "project-upload",
      max: 20,
      windowMs: 10 * 60 * 1000
    });

    const { id } = await context.params;
    const project = await getWritableProjectForUser(id, user);

    if (!project) {
      return badRequest("项目不存在或无权修改。", 404);
    }

    const formData = await request.formData();
    const category = sanitizeProjectCategory(formData.get("category"));
    const files = formData.getAll("files").filter((item) => item instanceof File) as File[];

    if (files.length === 0) {
      return badRequest("请至少选择一个文件。");
    }

    if (files.length > maxFileCount) {
      return badRequest(`单次最多上传 ${maxFileCount} 个文件。`);
    }

    const projectStorageDir = path.join(storageDir, project.id);
    await fs.mkdir(projectStorageDir, { recursive: true });

    for (const file of files) {
      const fileName = sanitizeFileName(file.name);
      const extension = path.extname(fileName).toLowerCase();

      if (!allowedExtensions.has(extension)) {
        return badRequest(`文件 ${fileName} 类型不受支持。`);
      }

      if (file.size > maxFileBytes) {
        return badRequest(
          `文件 ${fileName} 超过 ${(maxFileBytes / 1024 / 1024).toFixed(0)}MB 限制。`
        );
      }

      const storedName = `${Date.now()}-${createId("upload")}-${fileName}`;
      const storedPath = path.join(projectStorageDir, storedName);
      const buffer = Buffer.from(await file.arrayBuffer());

      await fs.writeFile(storedPath, buffer);
      const parsed = await parseFileBuffer({
        buffer,
        fileName,
        mimeType: file.type || "application/octet-stream",
        category
      });

      project.records.push({
        id: createId("record"),
        category,
        fileName,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        uploadedAt: nowIso(),
        storedPath,
        ...parsed
      });
    }

    const savedProject = await saveProject(project);
    return ok({ project: savedProject });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "上传失败。");
  }
}
