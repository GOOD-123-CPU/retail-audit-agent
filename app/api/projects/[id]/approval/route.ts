import { getApprovalRequest, reviewApproval, submitApproval } from "@/lib/approval-store";
export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { normalizeInputText } from "@/lib/encoding";
import { assertTrustedMutationRequest, badRequest, ok, readJsonBody } from "@/lib/http";
import { hasPermission } from "@/lib/permissions";
import { getReadableProjectForUser, getWritableProjectForUser } from "@/lib/projects";

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

    const approval = await getApprovalRequest(project.id);
    return ok({ approval });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "读取审批状态失败。");
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
    const { id } = await context.params;
    const project = await getWritableProjectForUser(id, user);
    if (!project) {
      return badRequest("项目不存在或无权修改。", 404);
    }

    const body = await readJsonBody<{ comment?: string }>(request);
    const approval = await submitApproval(
      project,
      user,
      normalizeInputText(String(body.comment ?? ""), { maxLength: 200 })
    );
    return ok({ approval });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "提交审批失败。");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return badRequest("请先登录。", 401);
    }

    assertTrustedMutationRequest(request);
    if (!hasPermission(user, "users.manage")) {
      return badRequest("当前账号没有审批权限。", 403);
    }

    const { id } = await context.params;
    const body = await readJsonBody<{ action?: "approve" | "reject"; comment?: string }>(request);
    if (!body.action || !["approve", "reject"].includes(body.action)) {
      return badRequest("非法审批动作。");
    }

    const approval = await reviewApproval(
      id,
      user,
      body.action,
      normalizeInputText(String(body.comment ?? ""), { maxLength: 200 })
    );
    return ok({ approval });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "审批处理失败。");
  }
}
