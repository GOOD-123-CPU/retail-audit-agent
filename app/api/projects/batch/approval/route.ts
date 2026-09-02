import { submitApproval } from "@/lib/approval-store";
export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { normalizeInputText } from "@/lib/encoding";
import { assertTrustedMutationRequest, badRequest, ok, readJsonBody } from "@/lib/http";
import { getWritableProjectForUser } from "@/lib/projects";
import { sanitizeIdList } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return badRequest("请先登录。", 401);
    }

    assertTrustedMutationRequest(request);
    const body = await readJsonBody<{ projectIds?: string[]; comment?: string }>(request);
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

      const approval = await submitApproval(
        project,
        user,
        normalizeInputText(String(body.comment ?? ""), { maxLength: 200 })
      );
      results.push({
        id: project.id,
        name: project.name,
        approvalStatus: approval.status
      });
    }

    return ok({ results });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "批量提交审批失败。");
  }
}
