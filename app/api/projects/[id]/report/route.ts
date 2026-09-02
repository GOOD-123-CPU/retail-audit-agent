export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { badRequest } from "@/lib/http";
import { canReadReport } from "@/lib/permissions";
import { getProjectById } from "@/lib/projects";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return badRequest("请先登录。", 401);
  }

  const { id } = await context.params;
  const project = await getProjectById(id);

  if (!project || !canReadReport(user, project)) {
    return badRequest("项目不存在或无权访问报告。", 404);
  }

  return new Response(project.reportMarkdown || "# 报告暂未生成", {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.id}.md"`
    }
  });
}
