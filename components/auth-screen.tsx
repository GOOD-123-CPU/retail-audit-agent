"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

export function AuthScreen({ allowRegister }: { allowRegister: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError("");

    const payload = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      name: String(formData.get("name") ?? "")
    };

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setError(result?.error ?? "提交失败");
      return;
    }

    startTransition(() => {
      router.push("/projects");
      router.refresh();
    });
  }

  return (
    <main className="auth-shell">
      <section className="panel auth-card">
        <aside className="auth-side">
          <div className="stack">
            <span className="pill pill--sidebar">统一审计工作台</span>
            <h1>零售业 AI 审计系统</h1>
            <p>
              把资料接收、规则分析、问答、底稿、审批与报告放进同一套系统里，
              便于管理员和企业用户在统一入口完成协作。
            </p>
            <div className="checkpoint-list checkpoint-list--auth">
              <article className="checkpoint">
                <strong>统一入口</strong>
                <p>项目总览、项目工作台、批量作业与规则治理共用同一套权限与导航。</p>
              </article>
              <article className="checkpoint">
                <strong>安全默认开启</strong>
                <p>JWT 会话、HttpOnly Cookie、同源校验、限流和安全响应头默认生效。</p>
              </article>
              <article className="checkpoint">
                <strong>初始化账号就绪</strong>
                <p>系统会自动确保管理员账号和公司用户账号存在，适合直接启动演示与验收。</p>
              </article>
            </div>
          </div>
        </aside>
        <div className="auth-main">
          <div className="card__header">
            <div>
              <h2>{mode === "login" ? "登录系统" : "注册账号"}</h2>
              <p className="muted">
                {mode === "login"
                  ? "进入统一工作台，继续执行项目分析、问答、报告和底稿处理。"
                  : "公开注册默认关闭，只有初始化阶段或显式启用时才允许自注册。"}
              </p>
            </div>
            <div className="actions">
              <button
                className={`button ${mode === "login" ? "button--primary" : "button--ghost"}`}
                onClick={() => setMode("login")}
                type="button"
              >
                登录
              </button>
              {allowRegister ? (
                <button
                  className={`button ${mode === "register" ? "button--primary" : "button--ghost"}`}
                  onClick={() => setMode("register")}
                  type="button"
                >
                  注册
                </button>
              ) : null}
            </div>
          </div>

          <form
            className="stack"
            action={(formData) => {
              startTransition(() => {
                void handleSubmit(formData);
              });
            }}
          >
            {mode === "register" ? (
              <label className="label">
                姓名
                <input className="input" name="name" placeholder="请输入姓名" required />
              </label>
            ) : null}

            <label className="label">
              邮箱
              <input className="input" name="email" placeholder="name@example.com" required type="email" />
            </label>

            <label className="label">
              密码
              <input className="input" minLength={8} name="password" placeholder="至少 8 位" required type="password" />
            </label>

            {error ? <div className="pill pill--high">{error}</div> : null}

            <button className="button button--primary" disabled={isPending} type="submit">
              {isPending ? "处理中..." : mode === "login" ? "登录并进入系统" : "注册并进入系统"}
            </button>
          </form>

          {!allowRegister ? (
            <div className="message-strip">
              当前已关闭公开注册，请使用管理员账号登录后在用户管理中创建企业用户。
            </div>
          ) : null}

          <div className="auth-footnote">
            <span>鉴权方式：JWT + HttpOnly Cookie</span>
            <span>权限模型：管理员 / 企业用户</span>
          </div>
        </div>
      </section>
    </main>
  );
}
