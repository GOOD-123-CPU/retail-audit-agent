export const dynamic = "force-dynamic";

import { getCurrentUser, updateUserRole } from "@/lib/auth";
import { assertTrustedMutationRequest, badRequest, ok, readJsonBody } from "@/lib/http";
import { hasPermission } from "@/lib/permissions";
import { assertRateLimit } from "@/lib/rate-limit";
import { deleteUser } from "@/lib/user-store";
import { Role } from "@/lib/types";

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
      return badRequest("当前账号没有用户管理权限。", 403);
    }

    const body = await readJsonBody<{ role?: string }>(request);
    const role = String(body.role ?? "") as Role;
    if (!["admin", "user"].includes(role)) {
      return badRequest("非法角色。");
    }

    const { id } = await context.params;
    const nextUser = await updateUserRole(id, role);
    return ok({ user: nextUser });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "更新失败。");
  }
}

export async function DELETE(
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
      action: "admin-delete-user",
      max: 10,
      windowMs: 10 * 60 * 1000
    });

    if (!hasPermission(user, "users.manage")) {
      return badRequest("当前账号没有用户管理权限。", 403);
    }

    const { id } = await context.params;
    if (id === user.id) {
      return badRequest("不能删除当前登录账号。");
    }

    await deleteUser(id);
    return ok({ deleted: true });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "删除失败。");
  }
}
