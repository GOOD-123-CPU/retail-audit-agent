import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-shell">
      <section className="panel card stack" style={{ width: "min(640px, 100%)" }}>
        <span className="pill">404</span>
        <h1>页面不存在或你没有访问权限</h1>
        <p className="muted">请返回项目列表，或者重新登录后再试。</p>
        <div className="actions">
          <Link className="button button--primary" href="/projects">
            返回项目列表
          </Link>
          <Link className="button button--ghost" href="/auth">
            重新登录
          </Link>
        </div>
      </section>
    </main>
  );
}
