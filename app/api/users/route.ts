export const dynamic = "force-dynamic";

import { createUser, getCurrentUser, readUsers, toSessionUser } from "@/lib/auth";
import { assertTrustedMutationRequest, badRequest, ok, readJsonBody } from "@/lib/http";
import { hasPermission } from "@/lib/permissions";
import { assertRateLimit } from "@/lib/rate-limit";
import { Role } from "@/lib/types";
import { sanitizePassword, sanitizeShortText } from "@/lib/validation";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return badRequest("请先登录。", 401);
    }

    if (!hasPermission(user, "users.manage")) {
      return badRequest("当前账号没有用户管理权限。", 403);
    }

    const users = await readUsers();
    return ok({
      users: users.map((item) => ({
        id: item.id,
        email: item.email,
        name: item.name,
        role: item.role,
        createdAt: item.createdAt,
        lastLoginAt: item.lastLoginAt ?? null
      }))
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "读取用户列表失败。");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return badRequest("请先登录。", 401);
    }

    assertTrustedMutationRequest(request);
    assertRateLimit(request, {
      action: "admin-create-user",
      max: 12,
      windowMs: 10 * 60 * 1000
    });

    if (!hasPermission(user, "users.manage")) {
      return badRequest("当前账号没有用户管理权限。", 403);
    }

    const body = await readJsonBody<{
      email?: string;
      name?: string;
      password?: string;
      role?: string;
    }>(request);
    const role = String(body.role ?? "user") as Role;
    if (!["admin", "user"].includes(role)) {
      return badRequest("非法角色。");
    }

    const nextUser = await createUser({
      email: sanitizeShortText(body.email, "邮箱", { maxLength: 120 }).toLowerCase(),
      name: sanitizeShortText(body.name, "姓名", { maxLength: 40 }),
      password: sanitizePassword(body.password),
      role
    });

    return ok({ user: toSessionUser(nextUser) }, { status: 201 });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "创建用户失败。");
  }
}
