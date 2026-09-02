export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth";
import { createProject, listProjectsForUser } from "@/lib/projects";
import { assertTrustedMutationRequest, badRequest, ok, readJsonBody } from "@/lib/http";
import { hasPermission } from "@/lib/permissions";
import { assertRateLimit } from "@/lib/rate-limit";
import { sanitizeShortText } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return badRequest("请先登录。", 401);
  }

  const projects = await listProjectsForUser(user);
  return ok({ projects });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return badRequest("请先登录。", 401);
    }

    assertTrustedMutationRequest(request);
    assertRateLimit(request, {
      action: "project-create",
      max: 20,
      windowMs: 10 * 60 * 1000
    });

    if (!hasPermission(user, "projects.create")) {
      return badRequest("当前账号没有创建项目权限。", 403);
    }

    const body = await readJsonBody<{
      name?: string;
      companyName?: string;
      year?: string;
      industry?: string;
    }>(request);

    const project = await createProject({
      name: sanitizeShortText(body.name, "项目名称", { maxLength: 80 }),
      companyName: sanitizeShortText(body.companyName, "被审计单位", {
        maxLength: 120
      }),
      year: sanitizeShortText(body.year, "年度", { maxLength: 8 }),
      industry: sanitizeShortText(body.industry, "行业", { maxLength: 40 }),
      ownerId: user.id
    });

    return ok({ project });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "创建项目失败。");
  }
}
