/**
 * 集中的环境变量读取入口。
 *
 * 安全约定：
 * - 生产环境（NODE_ENV=production）必须显式配置 JWT_SECRET，否则运行时立即失败；
 * - 代码中不保留任何真实密钥/密码默认值，敏感配置一律通过环境变量注入；
 * - AI 端点默认指向阿里云百炼官方 OpenAI 兼容端点，可替换为任意 OpenAI 兼容服务。
 */

function readJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (secret) {
    if (secret.length < 16) {
      throw new Error("JWT_SECRET 至少需要 16 个字符，请使用强随机密钥。");
    }
    return secret;
  }

  // next build 阶段不运行服务，允许跳过校验；实际对外提供服务时必须配置。
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  if (process.env.NODE_ENV === "production" && !isBuildPhase) {
    throw new Error(
      "生产环境必须通过环境变量配置 JWT_SECRET（至少 16 个强随机字符），禁止使用开发默认值。"
    );
  }

  return "retail-audit-agent-dev-only-secret";
}

export const env = {
  appName: process.env.APP_NAME ?? "Retail Audit AI Agent",
  appUrl: process.env.APP_URL ?? "http://localhost:3000",

  /** 惰性求值：仅在首次签发/校验 JWT 时读取，避免构建期误触发校验。 */
  get jwtSecret(): string {
    return readJwtSecret();
  },

  allowPublicRegistration: process.env.ALLOW_PUBLIC_REGISTRATION === "true",

  /** 任意 OpenAI 兼容 Chat Completions 端点（默认：阿里云百炼 DashScope）。 */
  qwenApiUrl:
    process.env.QWEN_API_URL ??
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  qwenApiKey: process.env.QWEN_API_KEY ?? "",
  qwenPrimaryModel: process.env.QWEN_PRIMARY_MODEL ?? "qwen3-max",
  /** 逗号分隔的备用模型列表，主模型不可用时按序回退。 */
  qwenFallbackModels: process.env.QWEN_FALLBACK_MODELS ?? "qwen-plus,qwen-turbo",

  /**
   * 首次启动自动创建的演示账号（仅供本地体验，账号密码已在 README 公开，
   * 非机密信息；生产部署请通过环境变量覆盖或禁用）。
   */
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL ?? "admin@retail-audit.local",
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD ?? "AdminDemo_2026",
  defaultAdminName: process.env.DEFAULT_ADMIN_NAME ?? "System Administrator",
  defaultCompanyUserEmail:
    process.env.DEFAULT_COMPANY_USER_EMAIL ?? "company@retail-audit.local",
  defaultCompanyUserPassword: process.env.DEFAULT_COMPANY_USER_PASSWORD ?? "CompanyDemo_2026",
  defaultCompanyUserName: process.env.DEFAULT_COMPANY_USER_NAME ?? "Company Audit User",

  /** mysql | sqlite | json（json 为纯文件兜底模式）。 */
  databaseProvider: process.env.DATABASE_PROVIDER ?? "mysql",
  /** SQLite 模式下的数据库文件路径（默认 data/retail-audit.db）。 */
  sqlitePath: process.env.SQLITE_PATH ?? "",
  mysqlHost: process.env.MYSQL_HOST ?? "127.0.0.1",
  mysqlPort: Number(process.env.MYSQL_PORT ?? "3306"),
  mysqlUser: process.env.MYSQL_USER ?? "root",
  /** 出于安全考虑不设默认密码；未配置 MySQL 时系统自动回退到本地 JSON 文件存储。 */
  mysqlPassword: process.env.MYSQL_PASSWORD ?? "",
  mysqlDatabase: process.env.MYSQL_DATABASE ?? "retail_audit_agent"
};
