export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { getReadableProjectForUser } from "@/lib/projects";
import { badRequest, ok } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return badRequest("请先登录。", 401);
  }

  const { id } = await context.params;
  const project = await getReadableProjectForUser(id, user);

  if (!project) {
    return badRequest("项目不存在或无权访问。", 404);
  }

  return ok({ project });
}
