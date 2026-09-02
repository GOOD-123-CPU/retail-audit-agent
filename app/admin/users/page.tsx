import Link from "next/link";
import { redirect } from "next/navigation";

import { ConsoleShell } from "@/components/console-shell";
import { UserAdminPanel } from "@/components/user-admin-panel";
import { readUsers, requireCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  const user = await requireCurrentUser();
  if (!hasPermission(user, "users.manage")) {
    redirect("/projects");
  }

  const users = await readUsers();
  const admins = users.filter((item) => item.role === "admin").length;

  return (
    <ConsoleShell
      actions={
        <Link className="button button--ghost" href="/projects">
          返回项目总览
        </Link>
      }
      eyebrow="后台治理"
      section="users"
      stats={[
        { label: "用户总数", value: users.length },
        { label: "管理员", value: admins, tone: "ok" },
        { label: "企业用户", value: users.length - admins }
      ]}
      subtitle="集中管理账号、角色与权限边界，系统始终至少保留一名管理员。"
      title="用户管理中心"
      user={user}
    >
      <UserAdminPanel
        currentUserId={user.id}
        users={users.map((item) => ({
          id: item.id,
          email: item.email,
          name: item.name,
          role: item.role,
          createdAt: item.createdAt,
          lastLoginAt: item.lastLoginAt ?? null
        }))}
      />
    </ConsoleShell>
  );
}
