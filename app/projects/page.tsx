import Link from "next/link";

import { ConsoleShell } from "@/components/console-shell";
import { CreateProjectForm } from "@/components/create-project-form";
import { ProjectList } from "@/components/project-list";
import { readUsers, requireCurrentUser } from "@/lib/auth";
import { listProjectsForUser } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireCurrentUser();
  const projects = await listProjectsForUser(user);

  return (
    <ConsoleShell
      actions={
        <>
          <Link className="button button--secondary" href="/projects/batch">
            进入批量作业
          </Link>
          {user.role === "admin" ? (
            <Link className="button button--ghost" href="/admin/rules">
              规则治理
            </Link>
          ) : null}
        </>
      }
      eyebrow="审计控制台"
      section="projects"
      stats={[
        { label: "项目总数", value: projects.length },
        {
          label: "高风险项目",
          value: projects.filter((project) => project.highRiskCount > 0).length,
          tone: "danger"
        },
        { label: "当前角色", value: user.role === "admin" ? "管理员" : "审计用户" }
      ]}
      subtitle={`当前登录：${user.name}。统一处理项目创建、台账查看、用户权限与审计执行入口。`}
      title="项目总览"
      user={user}
    >
      <section className="workspace-grid">
        <div className="stack">
          <CreateProjectForm />
          <ProjectList projects={projects} />
        </div>
        <div className="stack">
          <section className="card stack">
            <div className="card__header">
              <div>
                <h3>执行建议</h3>
                <p className="muted">按审计底稿习惯组织资料与流程，确保结论可追溯、可复核、可答辩。</p>
              </div>
            </div>
            <div className="checkpoint-list">
              <article className="checkpoint">
                <strong>第一步：建立项目与期间范围</strong>
                <p>创建项目后先上传财务台账，确保系统能够生成基础指标与趋势信号。</p>
              </article>
              <article className="checkpoint">
                <strong>第二步：补齐票据与合同</strong>
                <p>再补充发票、协议、结算单和经营说明，让证据链覆盖高风险事项。</p>
              </article>
              <article className="checkpoint">
                <strong>第三步：执行分析与审批</strong>
                <p>完成风险扫描后进入问答、底稿、审批和报告导出，形成完整审计闭环。</p>
              </article>
            </div>
          </section>
        </div>
      </section>
    </ConsoleShell>
  );
}
