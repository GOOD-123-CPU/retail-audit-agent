import Link from "next/link";
import { redirect } from "next/navigation";

import { ConsoleShell } from "@/components/console-shell";
import { RuleAdminPanel } from "@/components/rule-admin-panel";
import { requireCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listRuleConfigs } from "@/lib/rule-configs";

export const dynamic = "force-dynamic";

export default async function RulesAdminPage() {
  const user = await requireCurrentUser();
  if (!hasPermission(user, "users.manage")) {
    redirect("/projects");
  }

  const rules = await listRuleConfigs();

  return (
    <ConsoleShell
      actions={
        <Link className="button button--ghost" href="/projects">
          返回项目总览
        </Link>
      }
      eyebrow="后台治理"
      section="rules"
      stats={[
        { label: "规则总数", value: rules.length },
        {
          label: "启用规则",
          value: rules.filter((item) => item.isEnabled).length,
          tone: "ok"
        },
        {
          label: "停用规则",
          value: rules.filter((item) => !item.isEnabled).length
        }
      ]}
      subtitle="集中维护规则启停、关键词、验证逻辑与审计程序，确保解释与结论一致。"
      title="规则治理中心"
      user={user}
    >
      <RuleAdminPanel initialRules={rules} />
    </ConsoleShell>
  );
}
