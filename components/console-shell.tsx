import Link from "next/link";
import { ReactNode } from "react";

import { LogoutButton } from "@/components/logout-button";
import { SessionUser } from "@/lib/types";

type ConsoleStat = {
  label: string;
  value: string | number;
  tone?: "default" | "danger" | "ok";
};

type ConsoleShellProps = {
  user: SessionUser;
  section: "projects" | "batch" | "rules" | "users";
  title: string;
  subtitle: string;
  eyebrow?: string;
  actions?: ReactNode;
  stats?: ConsoleStat[];
  children: ReactNode;
};

function roleLabel(role: SessionUser["role"]) {
  return role === "admin" ? "系统管理员" : "审计用户";
}

export function ConsoleShell({
  user,
  section,
  title,
  subtitle,
  eyebrow,
  actions,
  stats = [],
  children
}: ConsoleShellProps) {
  const navItems = [
    { href: "/projects", label: "项目总览", key: "projects", adminOnly: false },
    { href: "/projects/batch", label: "批量作业", key: "batch", adminOnly: false },
    { href: "/admin/rules", label: "规则治理", key: "rules", adminOnly: true },
    { href: "/admin/users", label: "用户管理", key: "users", adminOnly: true }
  ] as const;

  return (
    <main className="console-shell">
      <aside className="console-sidebar">
        <div className="console-brand">
          <span className="console-brand__eyebrow">Retail Audit Control</span>
          <strong>零售业 AI 审计系统</strong>
          <p>面向财务审计、风险核查和证据复核的统一工作台。</p>
        </div>

        <nav aria-label="主导航" className="console-nav">
          {navItems
            .filter((item) => !item.adminOnly || user.role === "admin")
            .map((item) => (
              <Link
                className={`console-nav__item ${section === item.key ? "console-nav__item--active" : ""}`}
                href={item.href}
                key={item.href}
              >
                <span>{item.label}</span>
                {section === item.key ? <span className="console-nav__marker" /> : null}
              </Link>
            ))}
        </nav>

        <div className="console-sidebar__meta">
          <div className="console-usercard">
            <span className="pill pill--sidebar">{roleLabel(user.role)}</span>
            <strong>{user.name}</strong>
            <p>{user.email}</p>
          </div>

          <div className="console-sidebar__note">
            <h3>安全边界</h3>
            <p>JWT 会话、同源校验、角色权限、输入净化与项目归属校验默认生效。</p>
          </div>

          <LogoutButton />
        </div>
      </aside>

      <div className="console-main">
        <header className="page-header">
          <div className="page-header__intro">
            {eyebrow ? <span className="page-header__eyebrow">{eyebrow}</span> : null}
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {actions ? <div className="page-header__actions actions">{actions}</div> : null}
        </header>

        {stats.length > 0 ? (
          <section className="stats stats--console">
            {stats.map((stat) => (
              <div className={`stat stat--${stat.tone ?? "default"}`} key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </section>
        ) : null}

        <section className="console-content">{children}</section>
      </div>
    </main>
  );
}
