import { runProjectAnalysis } from "@/lib/analysis";
export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { assertTrustedMutationRequest, badRequest, ok } from "@/lib/http";
import { getReadableProjectForUser, getWritableProjectForUser, saveProject } from "@/lib/projects";
import { assertRateLimit } from "@/lib/rate-limit";
import { listWorkpapers } from "@/lib/workpapers";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return badRequest("请先登录。", 401);
    }

    const { id } = await context.params;
    const project = await getReadableProjectForUser(id, user);

    if (!project) {
      return badRequest("项目不存在或无权访问。", 404);
    }

    const workpapers = await listWorkpapers(project.id);
    return ok({ workpapers });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "读取底稿失败。");
  }
}

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
      action: "project-workpapers",
      max: 15,
      windowMs: 10 * 60 * 1000
    });

    const { id } = await context.params;
    const project = await getWritableProjectForUser(id, user);

    if (!project) {
      return badRequest("项目不存在或无权修改。", 404);
    }

    const analyzed = await runProjectAnalysis(project);
    const saved = await saveProject(analyzed);
    const workpapers = await listWorkpapers(saved.id);
    return ok({ project: saved, workpapers });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "生成底稿失败。");
  }
}
