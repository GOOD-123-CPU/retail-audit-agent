# 更新日志 / Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 格式与
[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 计划中

- 报告页可视化图表（月度财务趋势、风险分布）
- 英文界面（i18n）
- OIDC / 企业微信 SSO 登录

## [1.2.0] - 2026-09-02

### 新增

- **SQLite 存储模式**：`DATABASE_PROVIDER=sqlite` 零外部依赖运行，数据层抽象为
  MySQL / SQLite / JSON 三模式统一接口（`lib/db.ts`）
- **Docker 部署体系**：多阶段构建 Dockerfile（standalone 产物、非 root 运行、
  内置 healthcheck）、docker-compose 编排（app + MySQL，MySQL 按 profile 可选）
- **健康检查端点** `GET /api/health`：返回存储模式、连通性与运行状态
- **用户管理中心** `/admin/users`：账号列表、创建、角色调整、删除；
  API 补齐 `GET /api/users` 与 `DELETE /api/users/[id]`，
  含"不能删除自身"与"至少保留一名管理员"双重保护
- **规则引擎扩展至 8 条**：新增毛利率异常下滑、退货异常回冲、收入质量存疑
  （应收激增）、费用归集异常四类风险规则
- **新增财务信号**：毛利率月度趋势斜率、退货率前后半程对比、应收周转天数、
  费用合计占比（`ProjectMetricSnapshot` 扩展 3 个指标字段）
- **单元测试体系**（Vitest，46 个用例）：规则评分、向量检索、编码修复、
  HTTP 安全层、限流、输入校验、权限、字段抽取、分析编排（mock AI）
- CI 增加 `npm run test` 门禁；`test:coverage` 覆盖率脚本

### 修复

- **乱码修复失效**（关键）：`stripControlChars` 误删 C1 控制区字符
  （U+0080–009F），而 latin1 双重编码乱码恰好落在该区段，导致数据在进入
  修复逻辑前即被破坏。现保留该区段并添加回归测试

### 变更

- AI 请求增加 25 秒超时（AbortController）；408/429/5xx 指数退避重试，
  超时直接切换备用模型
- 模型回退链环境变量化（`QWEN_FALLBACK_MODELS`）
- 风险 AI 解释由串行改为 3 并发受限并行
- 用户管理由项目页内嵌迁出为独立管理页

## [1.1.0] - 2026-09-02

### 新增

- 开源仓库设施：MIT LICENSE、中英双语 README、CONTRIBUTING / SECURITY /
  CODE_OF_CONDUCT、GitHub Issue/PR 模板、GitHub Actions CI

### 安全

- `JWT_SECRET` 生产环境缺失即拒绝启动（≥16 字符强校验）
- 移除代码内第三方 AI 网关、数据库密码等硬编码默认值；
  AI 默认端点改为阿里云百炼官方 DashScope 兼容模式
- 演示数据全部虚构化；`.env.local`、运行数据目录排除出版本库

### 变更

- 演示账号密码更新为 `AdminDemo_2026` / `CompanyDemo_2026`

## [1.0.0] - 2026-04

### 首个版本

- Next.js 15 + React 19 + TypeScript 零售业 AI 审计工作台
- 规则驱动风险识别、通义千问兼容 AI 解释与问答、多格式资料解析
  （xlsx/csv/pdf/OCR）、轻量向量检索、审批流、审计底稿、Markdown 报告
- MySQL 与本地 JSON 双存储

[unreleased]: https://github.com/GOOD-123-CPU/retail-audit-agent/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/GOOD-123-CPU/retail-audit-agent/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/GOOD-123-CPU/retail-audit-agent/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/GOOD-123-CPU/retail-audit-agent/releases/tag/v1.0.0
