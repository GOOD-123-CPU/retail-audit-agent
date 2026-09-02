import Link from "next/link";

import { BatchProjectManager } from "@/components/batch-project-manager";
import { ConsoleShell } from "@/components/console-shell";
import { requireCurrentUser } from "@/lib/auth";
import { listProjectsForUser } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function BatchProjectsPage() {
  const user = await requireCurrentUser();
  const projects = await listProjectsForUser(user);

  return (
    <ConsoleShell
      actions={
        <Link className="button button--ghost" href="/projects">
          返回项目总览
        </Link>
      }
      eyebrow="批量执行"
      section="batch"
      stats={[
        { label: "可选项目", value: projects.length },
        {
          label: "已分析项目",
          value: projects.filter((project) => project.status === "analyzed").length
        },
        {
          label: "高风险项目",
          value: projects.filter((project) => project.highRiskCount > 0).length,
          tone: "danger"
        }
      ]}
      subtitle="集中触发风险分析、审批提交与月度批处理任务，适合项目集管理。"
      title="批量项目管理中心"
      user={user}
    >
      <BatchProjectManager initialProjects={projects} />
    </ConsoleShell>
  );
}
