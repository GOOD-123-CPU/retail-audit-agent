import { runProjectAnalysis } from "@/lib/analysis";
export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { assertTrustedMutationRequest, badRequest, ok } from "@/lib/http";
import { getWritableProjectForUser, saveProject } from "@/lib/projects";
import { assertRateLimit } from "@/lib/rate-limit";

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
      action: "project-analyze",
      max: 15,
      windowMs: 10 * 60 * 1000
    });

    const { id } = await context.params;
    const project = await getWritableProjectForUser(id, user);

    if (!project) {
      return badRequest("项目不存在或无权修改。", 404);
    }

    const analyzed = await runProjectAnalysis(project);
    const savedProject = await saveProject(analyzed);
    return ok({ project: savedProject });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "分析失败。");
  }
}
