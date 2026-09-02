import { runProjectAnalysis } from "@/lib/analysis";
export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { assertTrustedMutationRequest, badRequest, ok, readJsonBody } from "@/lib/http";
import { getWritableProjectForUser, saveProject } from "@/lib/projects";
import { sanitizeIdList } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return badRequest("请先登录。", 401);
    }

    assertTrustedMutationRequest(request);
    const body = await readJsonBody<{ projectIds?: string[] }>(request);
    const projectIds = sanitizeIdList(body.projectIds, "项目", 20);

    if (projectIds.length === 0) {
      return badRequest("请至少选择一个项目。");
    }

    const results = [];
    for (const projectId of projectIds) {
      const project = await getWritableProjectForUser(projectId, user);
      if (!project) {
        continue;
      }

      const analyzed = await runProjectAnalysis(project);
      const saved = await saveProject(analyzed);
      results.push({
        id: saved.id,
        name: saved.name,
        status: saved.status,
        riskCount: saved.risks.length
      });
    }

    return ok({ results });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "批量分析失败。");
  }
}
